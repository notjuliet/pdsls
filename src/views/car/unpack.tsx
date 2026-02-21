import { fromStream } from "@atcute/repo";
import { zip, type ZipEntry } from "@mary/zip";
import { Title } from "@solidjs/meta";
import { createSignal, onCleanup } from "solid-js";
import { createDropHandler, createFileChangeHandler, handleDragOver } from "./file-handlers.js";
import { createLogger, LoggerView } from "./logger.jsx";
import { isIOS, toJsonValue, WelcomeView } from "./shared.jsx";

// Check if browser natively supports File System Access API
const hasNativeFileSystemAccess = "showSaveFilePicker" in window;

// HACK: Disable compression on WebKit due to an error being thrown
const isWebKit =
  isIOS || (/AppleWebKit/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent));

const INVALID_CHAR_RE = /[<>:"/\\|?*\x00-\x1F]/g;
const filenamify = (name: string) => {
  return name.replace(INVALID_CHAR_RE, "~");
};

export const UnpackToolView = () => {
  const logger = createLogger();
  const [pending, setPending] = createSignal(false);

  let abortController: AbortController | undefined;

  onCleanup(() => {
    abortController?.abort();
  });

  const unpackToZip = async (file: File) => {
    abortController?.abort();
    abortController = new AbortController();
    const signal = abortController.signal;

    setPending(true);
    logger.log(`Starting extraction`);

    let repo: Awaited<ReturnType<typeof fromStream>> | undefined;

    const stream = file.stream();
    repo = fromStream(stream);

    try {
      let count = 0;

      // On Safari/browsers without native File System Access API, use blob download
      if (!hasNativeFileSystemAccess) {
        const chunks: BlobPart[] = [];

        const entryGenerator = async function* (): AsyncGenerator<ZipEntry> {
          const progress = logger.progress(`Unpacking records (0 entries)`);

          try {
            for await (const entry of repo) {
              if (signal.aborted) return;

              try {
                const record = toJsonValue(entry.record);
                const filename = `${entry.collection}/${filenamify(entry.rkey)}.json`;
                const data = JSON.stringify(record, null, 2);

                yield { filename, data, compress: isWebKit ? false : "deflate" };
                count++;
                progress.update(`Unpacking records (${count} entries)`);
              } catch {
                // Skip entries with invalid data
              }
            }
          } finally {
            progress[Symbol.dispose]?.();
          }
        };

        for await (const chunk of zip(entryGenerator())) {
          if (signal.aborted) return;
          chunks.push(chunk as BlobPart);
        }

        if (signal.aborted) return;

        logger.log(`${count} records extracted`);
        logger.log(`Creating download...`);

        const blob = new Blob(chunks, { type: "application/zip" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${file.name.replace(/\.car$/, "")}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        logger.log(`Finished! Download started.`);
        setPending(false);
        return;
      }

      // Native File System Access API path
      let writable: FileSystemWritableFileStream | undefined;

      // Create async generator that yields ZipEntry as we read from CAR
      const entryGenerator = async function* (): AsyncGenerator<ZipEntry> {
        const progress = logger.progress(`Unpacking records (0 entries)`);

        try {
          for await (const entry of repo) {
            if (signal.aborted) return;

            // Prompt for save location on first record
            if (writable === undefined) {
              const waiting = logger.progress(`Waiting for user...`);

              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fd = await (window as any).showSaveFilePicker({
                    suggestedName: `${file.name.replace(/\.car$/, "")}.zip`,
                    id: "car-unpack",
                    startIn: "downloads",
                    types: [
                      {
                        description: "ZIP archive",
                        accept: { "application/zip": [".zip"] },
                      },
                    ],
                  })
                  .catch((err: unknown) => {
                    if (err instanceof DOMException && err.name === "AbortError") {
                      logger.warn(`File picker was cancelled`);
                    } else {
                      logger.warn(`Something went wrong when opening the file picker`);
                    }
                    return undefined;
                  });

                if (!fd) {
                  logger.warn(`No file handle obtained`);
                  return;
                }

                writable = await fd.createWritable();

                if (writable === undefined) {
                  logger.warn(`Failed to create writable stream`);
                  return;
                }
              } finally {
                waiting[Symbol.dispose]?.();
              }
            }

            try {
              const record = toJsonValue(entry.record);
              const filename = `${entry.collection}/${filenamify(entry.rkey)}.json`;
              const data = JSON.stringify(record, null, 2);

              yield { filename, data, compress: isWebKit ? false : "deflate" };
              count++;
              progress.update(`Unpacking records (${count} entries)`);
            } catch {
              // Skip entries with invalid data
            }
          }
        } finally {
          progress[Symbol.dispose]?.();
        }
      };

      // Stream entries directly to zip, then to file
      let writeCount = 0;
      for await (const chunk of zip(entryGenerator())) {
        if (signal.aborted) {
          await writable?.abort();
          return;
        }
        if (writable === undefined) {
          // User cancelled file picker
          setPending(false);
          return;
        }
        writeCount++;
        // Await every 100th write to apply backpressure
        if (writeCount % 100 === 0) {
          await writable.write(chunk as BufferSource);
        } else {
          writable.write(chunk as BufferSource);
        }
      }

      if (signal.aborted) return;

      if (writable === undefined) {
        logger.warn(`CAR file has no records`);
        setPending(false);
        return;
      }

      logger.log(`${count} records extracted`);

      {
        const flushProgress = logger.progress(`Flushing writes...`);
        try {
          await writable.close();
          logger.log(`Finished! File saved successfully.`);
        } catch (err) {
          logger.error(`Failed to save file: ${err}`);
          throw err; // Re-throw to be caught by outer catch
        } finally {
          flushProgress[Symbol.dispose]?.();
        }
      }
    } catch (err) {
      if (signal.aborted) return;
      logger.error(`Error: ${err}\nFile might be malformed, or might not be a CAR archive`);
    } finally {
      await repo?.dispose();
      if (!signal.aborted) {
        setPending(false);
      }
    }
  };

  const handleFileChange = createFileChangeHandler(unpackToZip);

  // Wrap handleDrop to prevent multiple simultaneous uploads
  const baseDrop = createDropHandler(unpackToZip);
  const handleDrop = (e: DragEvent) => {
    if (pending()) return;
    baseDrop(e);
  };

  return (
    <>
      <Title>Unpack archive - PDSls</Title>
      <WelcomeView
        title="Unpack archive"
        subtitle="Upload a CAR file to extract all records into a ZIP archive."
        loading={pending()}
        onFileChange={handleFileChange}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      />
      <div class="w-full max-w-3xl px-2">
        <LoggerView logger={logger} />
      </div>
    </>
  );
};
