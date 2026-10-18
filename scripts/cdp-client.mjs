import net from 'net';
import crypto from 'crypto';

/**
 * Minimal zero-dependency WebSocket client for Chrome DevTools Protocol.
 */
export function createCDPConnection(wsUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(wsUrl);
    const socket = net.connect(url.port ? Number(url.port) : 9222, url.hostname, () => {
      const key = crypto.randomBytes(16).toString('base64');
      socket.write(
        `GET ${url.pathname} HTTP/1.1\r\n` +
        `Host: ${url.host}\r\n` +
        `Upgrade: websocket\r\n` +
        `Connection: Upgrade\r\n` +
        `Sec-WebSocket-Key: ${key}\r\n` +
        `Sec-WebSocket-Version: 13\r\n\r\n`
      );
    });

    let isUpgraded = false;
    let buffer = Buffer.alloc(0);
    let nextId = 1;
    const pending = new Map();
    const eventHandlers = new Map();

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!isUpgraded) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          const headers = buffer.slice(0, headerEnd).toString();
          if (headers.includes('101')) {
            isUpgraded = true;
            buffer = buffer.slice(headerEnd + 4);
            resolve({ send, on, close });
          } else {
            reject(new Error(`WebSocket handshake failed:\n${headers}`));
            socket.destroy();
            return;
          }
        }
      }

      if (isUpgraded) {
        while (buffer.length >= 2) {
          const firstByte = buffer[0];
          const secondByte = buffer[1];
          const opcode = firstByte & 0x0f;
          let payloadLength = secondByte & 0x7f;
          let offset = 2;

          if (payloadLength === 126) {
            if (buffer.length < 4) break;
            payloadLength = buffer.readUInt16BE(2);
            offset = 4;
          } else if (payloadLength === 127) {
            if (buffer.length < 10) break;
            payloadLength = Number(buffer.readBigUInt64BE(2));
            offset = 10;
          }

          if (buffer.length < offset + payloadLength) break;
          const payload = buffer.slice(offset, offset + payloadLength);
          buffer = buffer.slice(offset + payloadLength);

          if (opcode === 0x1) {
            // Text frame
            try {
              const msg = JSON.parse(payload.toString('utf8'));
              if (msg.id && pending.has(msg.id)) {
                const { resolve: reqResolve, reject: reqReject } = pending.get(msg.id);
                pending.delete(msg.id);
                if (msg.error) {
                  reqReject(new Error(msg.error.message || JSON.stringify(msg.error)));
                } else {
                  reqResolve(msg.result);
                }
              } else if (msg.method && eventHandlers.has(msg.method)) {
                for (const handler of eventHandlers.get(msg.method)) {
                  handler(msg.params);
                }
              }
            } catch (err) {
              console.error('Error parsing CDP frame:', err);
            }
          } else if (opcode === 0x8) {
            // Close frame
            socket.end();
          }
        }
      }
    });

    socket.on('error', (err) => {
      reject(err);
    });

    function send(method, params = {}) {
      return new Promise((res, rej) => {
        const id = nextId++;
        pending.set(id, { resolve: res, reject: rej });
        const text = JSON.stringify({ id, method, params });
        const textBuf = Buffer.from(text, 'utf8');

        // Client must mask frames
        const mask = crypto.randomBytes(4);
        let header;
        const len = textBuf.length;

        if (len < 126) {
          header = Buffer.alloc(6);
          header[0] = 0x81; // FIN + text opcode
          header[1] = 0x80 | len;
          mask.copy(header, 2);
        } else if (len <= 0xffff) {
          header = Buffer.alloc(8);
          header[0] = 0x81;
          header[1] = 0x80 | 126;
          header.writeUInt16BE(len, 2);
          mask.copy(header, 4);
        } else {
          header = Buffer.alloc(14);
          header[0] = 0x81;
          header[1] = 0x80 | 127;
          header.writeBigUInt64BE(BigInt(len), 2);
          mask.copy(header, 10);
        }

        const maskedPayload = Buffer.alloc(len);
        for (let i = 0; i < len; i++) {
          maskedPayload[i] = textBuf[i] ^ mask[i % 4];
        }

        socket.write(Buffer.concat([header, maskedPayload]));
      });
    }

    function on(method, handler) {
      if (!eventHandlers.has(method)) {
        eventHandlers.set(method, []);
      }
      eventHandlers.get(method).push(handler);
    }

    function close() {
      socket.destroy();
    }
  });
}
