import { fromStream } from "@atcute/repo";
import { zip, type ZipEntry } from "@mary/zip";
import { Title } from "@solidjs/meta";
import { FileSystemWritableFileStream, showSaveFilePicker } from "native-file-system-adapter";
import { createSignal, onCleanup } from "solid-js";
import { createLogger, LoggerView } from "./logger.jsx";
import { isIOS, toJsonValue, WelcomeView } from "./shared.jsx";

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
                const fd = await showSaveFilePicker({
                  suggestedName: `${file.name.replace(/\.car$/, "")}.zip`,
                  // @ts-expect-error: ponyfill doesn't have full typings
                  id: "car-unpack",
                  startIn: "downloads",
                  types: [
                    {
                      description: "ZIP archive",
                      accept: { "application/zip": [".zip"] },
                    },
                  ],
                }).catch((err) => {
                  if (err instanceof DOMException && err.name === "AbortError") {
                    logger.warn(`File picker was cancelled`);
                  } else {
                    console.warn(err);
                    logger.warn(`Something went wrong when opening the file picker`);
                  }
                  return undefined;
                });

                writable = await fd?.createWritable();

                if (writable === undefined) {
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
        if (writeCount % 100 !== 0) {
          writable.write(chunk); // Fire and forget
        } else {
          await writable.write(chunk); // Await periodically to apply backpressure
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
        } finally {
          flushProgress[Symbol.dispose]?.();
        }
      }

      logger.log(`Finished!`);
    } catch (err) {
      if (signal.aborted) return;
      console.error("Failed to unpack CAR file:", err);
      logger.error(`Error: ${err}\nFile might be malformed, or might not be a CAR archive`);
    } finally {
      await repo?.dispose();
      if (!signal.aborted) {
        setPending(false);
      }
    }
  };

  const handleFileChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      unpackToZip(file);
    }
    input.value = "";
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    if (pending()) return;
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.name.endsWith(".car") || file.type === "application/vnd.ipld.car")) {
      unpackToZip(file);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
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
