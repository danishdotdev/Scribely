'use strict';

function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(images.length * 16);
  let offset = header.length + directory.length;
  images.forEach(({ size, png }, index) => {
    const entry = index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, entry);
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    directory.writeUInt8(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(png.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });

  return Buffer.concat([header, directory, ...images.map(image => image.png)]);
}

function buildIcns(images) {
  const chunks = images.map(({ type, png }) => {
    const chunk = Buffer.alloc(8 + png.length);
    chunk.write(type, 0, 4, 'ascii');
    chunk.writeUInt32BE(chunk.length, 4);
    png.copy(chunk, 8);
    return chunk;
  });

  const file = Buffer.alloc(8 + chunks.reduce((total, chunk) => total + chunk.length, 0));
  file.write('icns', 0, 4, 'ascii');
  file.writeUInt32BE(file.length, 4);
  let offset = 8;
  for (const chunk of chunks) {
    chunk.copy(file, offset);
    offset += chunk.length;
  }
  return file;
}

module.exports = { buildIco, buildIcns };
