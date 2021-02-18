import Debug from 'debug';

import { HciPacketType } from "./HciPacketType";

import { HciErrorCode } from "./HciError";
import { HciParserError } from "./HciError";
import { makeHciError, makeParserError} from "./HciError";
import { HciOcfControlAndBasebandCommands, HciOcfInformationParameters, HciOcfLeControllerCommands, HciOcfStatusParameters, HciOgf } from './HciOgfOcf';

const debug = Debug('nble-hci-cmd');

interface Command {
  opcode: number;
  connHandle?: number;
  payload?: Buffer;
}

class HciOpcode {
  public static build(opcode: { ogf: number, ocf: number }): number {
    return opcode.ogf << 10 | opcode.ocf;
  }

  public static expand(opcode: number): { ogf: number, ocf: number } {
    const ogf = opcode >> 10;
    const ocf = opcode & 1023;
    return { ogf, ocf };
  }
}

export interface HciCmdResult {
  numHciPackets: number;
  opcode: number;
  status: number;
  returnParameters?: Buffer;
}

type HciSendFunction = (pt: HciPacketType, data: Buffer) => void;

export class HciCmd {
  private onResult: ((_: HciCmdResult) => void) | null = null;

  public constructor(private send: HciSendFunction, private timeout: number = 2000) {
  }

  public async controlAndBaseband(params: {
    ocf: HciOcfControlAndBasebandCommands,
    connHandle?: number,
    payload?: Buffer
  }): Promise<HciCmdResult> {
    return await this.sendWaitResult({
      opcode: HciOpcode.build({
        ogf: HciOgf.ControlAndBasebandCommands,
        ocf: params.ocf,
      }),
      payload: params.payload,
      connHandle: params.connHandle,
    });
  }

  public async informationParameters(params: {
    ocf: HciOcfInformationParameters,
    connHandle?: number,
    payload?: Buffer
  }): Promise<HciCmdResult> {
    return await this.sendWaitResult({
      opcode: HciOpcode.build({
        ogf: HciOgf.InformationParameters,
        ocf: params.ocf,
      }),
      payload: params.payload,
      connHandle: params.connHandle,
    })
  }

  public async statusParameters(params: {
    ocf: HciOcfStatusParameters,
    connHandle?: number,
    payload?: Buffer
  }): Promise<HciCmdResult> {
    return await this.sendWaitResult({
      opcode: HciOpcode.build({
        ogf: HciOgf.StatusParameters,
        ocf: params.ocf,
      }),
      payload: params.payload,
      connHandle: params.connHandle,
    })
  }

  public async lowEnergy(params: {
    ocf: HciOcfLeControllerCommands,
    connHandle?: number,
    payload?: Buffer
  }): Promise<HciCmdResult> {
    return await this.sendWaitResult({
      opcode: HciOpcode.build({
        ogf: HciOgf.LeControllerCommands,
        ocf: params.ocf,
      }),
      payload: params.payload,
      connHandle: params.connHandle,
    });
  }

  private async sendWaitResult(cmd: Command): Promise<HciCmdResult> {
    return new Promise<HciCmdResult>((resolve, reject) => {
      if (this.onResult !== null) {
        return reject(makeParserError(HciParserError.Busy));
      }
      const complete = (err?: Error, evt?: HciCmdResult) => {
        clearTimeout(timeoutId);
        this.onResult = null;
        err ? reject(err) : resolve(evt!);
      };
      const timeoutId = setTimeout(
        () => complete(makeParserError(HciParserError.Timeout)), this.timeout
      );
      this.onResult = (evt: HciCmdResult) => {
        if (cmd.opcode !== evt.opcode) {
          return;
        }
        if (cmd.connHandle === undefined) {
          if (evt.status !== HciErrorCode.Success) {
            complete(makeHciError(evt.status));
          } else {
            complete(undefined, evt);
          }
        } else {
          if (!evt.returnParameters) {
            debug(`Return parameters are missing`);
            return;
          }
          if (evt.returnParameters.length < 2) {
            debug(`Cannot parse connection command complete event`);
            return; // NOTE: can't tell which connection
          }
          if (cmd.connHandle !== evt.returnParameters.readUInt16LE(0)) {
            return;
          }
          if (evt.status !== HciErrorCode.Success) {
            complete(makeHciError(evt.status));
          } else {
            complete(undefined, evt);
          }
        }
      };
      this.send(HciPacketType.HciCommand, this.buildCommand(cmd));
    });
  }

  public onCmdResult(result: HciCmdResult) {
    if (this.onResult) {
      this.onResult(result);
    }
  }

  private buildCommand(cmd: Command): Buffer {
    const payloadLength = cmd.payload?.length ?? 0;
    const buffer = Buffer.allocUnsafe(3 + payloadLength);

    let o = 0;
    o = buffer.writeUIntLE(cmd.opcode,    o, 2);
    o = buffer.writeUIntLE(payloadLength, o, 1);

    if (cmd.payload && payloadLength > 0) {
      cmd.payload.copy(buffer, 3);
    }

    return buffer;
  }
}