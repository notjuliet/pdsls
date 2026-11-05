import { makeCloudShape } from "../lib/cloud-shape";

const shape = makeCloudShape();
self.postMessage(shape, { transfer: [shape.buffer] });
