import { SerialPort, SerialPortOpenOptions } from 'serialport';
import { AutoDetectTypes } from '@serialport/bindings-cpp';
import { PortInfo } from '@serialport/bindings-interface';

import { HciDevice } from "./HciAdapter";

export class SerialHciDevice implements HciDevice {
  private port: SerialPort;

  constructor(options: SerialPortOpenOptions<AutoDetectTypes>) {
    options.autoOpen = false;
    options.parity = options.parity ?? 'none';
    options.rtscts = options.rtscts ?? true;
    options.baudRate = options.baudRate ?? 1_000_000;
    options.dataBits = options.dataBits ?? 8;
    options.stopBits = options.stopBits ?? 1;
    this.port = new SerialPort(options);
    this.port.on('error', (err) => console.log(err));
    // this.port.on('data', (data) => console.log(data.toString('hex')));
    this.port.on('close', () => console.log('close'));
  }

  async open() {
    await new Promise<void>((resolve,  reject) => {
      this.port.once('open', () => resolve());
      this.port.open((err) => reject(err));
    });
  }

  async close() {
    await new Promise<void>((resolve,  reject) => {
      this.port.close((err) => err ? reject(err) : resolve());
    });
  }

  write(data: Buffer): void {
    this.port.write(data);
  }

  on(evt: 'data', listener: (data: Buffer) => void): void;
  on(evt: 'error', listener: (data: NodeJS.ErrnoException) => void): void;
  on(evt: any, listener: (data: any) => void): void {
    this.port.on(evt, listener);
  }

  public static async findSerial(deviceId: number = 0): Promise<PortInfo | null> {
    const portInfos = await SerialPort.list();

    const hciPortInfos = portInfos.filter((port) => {
      if (port.manufacturer === 'SEGGER') {
        return true;
      }
      // Zephyr HCI UART
      if (port.vendorId === '2fe3' && port.productId === '0100') {
        return true;
      }
      return false;
    });

    if (hciPortInfos.length === 0) {
      throw new Error(`Cannot find appropriate port`);
    }

    return hciPortInfos[deviceId] ?? null;
  }
}

export async function createHciSerial(deviceId: number, serial: Partial<SerialPortOpenOptions<AutoDetectTypes>>) {
  if (!serial.path) {
    const path = (await SerialHciDevice.findSerial(deviceId))?.path;
    if (!path) {
      throw new Error('Cannot find appropriate port');
    }
    serial.path = path;
  }
  if (!serial.baudRate) {
    serial.baudRate = 1_000_000;
  }
  return new SerialHciDevice({ ...serial, path: serial.path, baudRate: serial.baudRate });
}