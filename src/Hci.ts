
import { EventEmitter } from "events";
import Debug from "debug";

import HciError from './HciError';
import { HciErrorCode } from './HciError';
import { HciOgf, HciOcfInformationParameters, HciOcfControlAndBasebandCommands, HciOcfLeControllerCommands } from './HciOgfOcf'
import {
  LeAdvertisingChannelMap, LeAdvertisingDataOperation, LeAdvertisingEventProperties,
  LeAdvertisingFilterPolicy, LeOwnAddressType, LePeerAddressType, LePhy, LePrimaryAdvertisingPhy,
  LeSecondaryAdvertisingPhy, LeSupportedStates, LeScanResponseDataOperation, LeScanningFilterPolicy,
  LeScanningPhy, LeScanType, LeScanFilterDuplicates, LeAdvertisingType
} from './HciLe';

const debug = Debug('nble-hci');

interface HciInit {
  cmdTimeout?: number;
  send: (data: Buffer) => void;
  setEventHandler: (_: (data: Buffer) => void) => void;
}

interface HciCommand {
  opcode: number;
  params?: Buffer;
}

enum HciEventCode {
  HCI_EVT_CMD_COMPLETE = 0x0e
}

interface HciEvtCmdComplete {
  numHciPackets: number;
  opcode: number;
  status: number;
  returnParameters: Buffer;
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

enum HciParserError {
  InvalidPayloadSize,
  Busy,
  Timeout,
}

export default class Hci extends EventEmitter {
  private sendRaw: (data: Buffer) => void;
  private cmdTimeout: number;

  private cmdOpcode = 0;
  private onCmdComplete: ((_: HciEvtCmdComplete) => void) | null = null;

  public constructor(init: HciInit) {
    super();

    this.sendRaw = init.send;
    this.cmdTimeout = init.cmdTimeout ?? 2000;
    init.setEventHandler(this.onData.bind(this));
  }

  public async reset(): Promise<void> {
    await this.send({
      opcode: HciOpcode.build({
        ogf: HciOgf.ControlAndBasebandCommands,
        ocf: HciOcfControlAndBasebandCommands.Reset,
      }),
    });
  }

  public async readLocalSupportedFeatures(): Promise<BigInt> {
    const result = await this.send({
      opcode: HciOpcode.build({
        ogf: HciOgf.InformationParameters,
        ocf: HciOcfInformationParameters.ReadLocalSupportedFeatures,
      }),
    });
    if (result.returnParameters.length < (64/8)) {
      throw this.makeError(HciParserError.InvalidPayloadSize);
    }
    return result.returnParameters.readBigUInt64LE(0); // TODO: parse LMP features
  }

  public async readLocalVersionInformation(): Promise<Buffer> {
    const result = await this.send({
      opcode: HciOpcode.build({
        ogf: HciOgf.InformationParameters,
        ocf: HciOcfInformationParameters.ReadLocalVersionInformation,
      }),
    });
    return result.returnParameters; // TODO: parse version information
  }

  public async readBdAddr(): Promise<number> {
    const result = await this.send({
      opcode: HciOpcode.build({
        ogf: HciOgf.InformationParameters,
        ocf: HciOcfInformationParameters.ReadBdAddr,
      }),
    });
    if (result.returnParameters.length < 6) {
      throw this.makeError(HciParserError.InvalidPayloadSize);
    }
    return result.returnParameters.readUIntLE(0, 6);
  }

  public async readLocalSupportedCommands(): Promise<Buffer> {
    const result = await this.send({
      opcode: HciOpcode.build({
        ogf: HciOgf.InformationParameters,
        ocf: HciOcfInformationParameters.ReadLocalSupportedCommands,
      }),
    });
    // TODO: parse bitmask
    return result.returnParameters;
  }

  public async setEventMask(): Promise<void> {
    // TODO pass event mask as argument
    const mask = Buffer.from('90e8040200800020', 'hex');
    await this.send({
      opcode: HciOpcode.build({
        ogf: HciOgf.ControlAndBasebandCommands,
        ocf: HciOcfControlAndBasebandCommands.SetEventMask,
      }),
      params: mask,
    });
  }

  public async setEventMaskPage2(): Promise<void> {
    // TODO pass event mask as argument
    const mask = Buffer.from('0000800000000000', 'hex');
    await this.send({
      opcode: HciOpcode.build({
        ogf: HciOgf.ControlAndBasebandCommands,
        ocf: HciOcfControlAndBasebandCommands.SetEventMaskPage2,
      }),
      params: mask,
    });
  }

  public async leSetEventMask(): Promise<void> {
    // TODO pass event mask as argument
    const mask = Buffer.from('5f1e0a0000000000', 'hex');
    const ocf = HciOcfLeControllerCommands.SetEventMask;
    await this.sendLeCommand(ocf, mask);
  }

  public async leReadBufferSize() {
    const ocf = HciOcfLeControllerCommands.ReadBufferSizeV1;
    const result = await this.sendLeCommand(ocf);

    const returnParameters = result.returnParameters;
    if (returnParameters.length < 3) {
      throw this.makeError(HciParserError.InvalidPayloadSize);
    }
    return {
      leAclDataPacketLength:    returnParameters.readUInt16LE(0),
      totalNumLeAclDataPackets: returnParameters.readUInt8(2),
    };
  }

  public async leReadBufferSizeV2() {
    const ocf = HciOcfLeControllerCommands.ReadBufferSizeV2;
    const result = await this.sendLeCommand(ocf);

    const returnParameters = result.returnParameters;
    if (returnParameters.length < 6) {
      throw this.makeError(HciParserError.InvalidPayloadSize);
    }
    return {
      leAclDataPacketLength:    returnParameters.readUInt16LE(0),
      totalNumLeAclDataPackets: returnParameters.readUInt8(2),
      isoDataPacketLength:      returnParameters.readUInt16LE(3),
      totalNumIsoDataPackets:   returnParameters.readUInt8(5),
    };
  }

  public async leReadSupportedFeatures(): Promise<BigInt> {
    const ocf = HciOcfLeControllerCommands.ReadLocalSupportedFeatures;
    const result = await this.sendLeCommand(ocf);

    if (result.returnParameters.length < (64/8)) {
      throw this.makeError(HciParserError.InvalidPayloadSize);
    }
    // TODO: parse bitmask
    return result.returnParameters.readBigUInt64LE(0);
  }

  public async leSetRandomAddress(randomAddress: number): Promise<void> {
    const payload = Buffer.allocUnsafe(6);
    payload.writeUIntLE(randomAddress, 0, 6);

    const ocf = HciOcfLeControllerCommands.SetRandomAddress;
    await this.sendLeCommand(ocf, payload);
  }

  public async leSetAdvertisingParameters(params: {
    advertisingIntervalMinMs: number,
    advertisingIntervalMaxMs: number,
    advertisingType: LeAdvertisingType,
    ownAddressType: LeOwnAddressType,
    peerAddressType: LePeerAddressType,
    peerAddress: number,
    advertisingChannelMap: LeAdvertisingChannelMap[],
    advertisingFilterPolicy: LeAdvertisingFilterPolicy,
  }): Promise<void> {

    const advertisingIntervalMin = Math.round(params.advertisingIntervalMinMs / 0.625);
    const advertisingIntervalMax = Math.round(params.advertisingIntervalMaxMs / 0.625);
    const advertisingChannelMap  = this.buildBitfield(params.advertisingChannelMap);

    const payload = Buffer.allocUnsafe(15);

    let o = 0;
    o = payload.writeUIntLE(advertisingIntervalMin,         o, 2);
    o = payload.writeUIntLE(advertisingIntervalMax,         o, 2);
    o = payload.writeUIntLE(params.advertisingType,         o, 1);
    o = payload.writeUIntLE(params.ownAddressType,          o, 1);
    o = payload.writeUIntLE(params.peerAddressType,         o, 1);
    o = payload.writeUIntLE(params.peerAddress,             o, 6);
    o = payload.writeUIntLE(advertisingChannelMap,          o, 1);
    o = payload.writeUIntLE(params.advertisingFilterPolicy, o, 1);

    const ocf = HciOcfLeControllerCommands.SetAdvertisingParameters;
    await this.sendLeCommand(ocf, payload);
  }

  public async leReadAdvertisingPhysicalChannelTxPower(): Promise<number> {
    const ocf = HciOcfLeControllerCommands.ReadAdvertisingPhysicalChannelTxPower;
    const result = await this.sendLeCommand(ocf);

    if (result.returnParameters.length < 1) {
      throw this.makeError(HciParserError.InvalidPayloadSize);
    }
    return result.returnParameters.readInt8(0);
  }

  public async leSetAdvertisingData(data: Buffer): Promise<void> {
    if (data.length > 31) {
      throw this.makeHciError(HciErrorCode.InvalidCommandParameter);
    }

    const payload = Buffer.alloc(1+31, 0);
    payload.writeUInt8(data.length, 0);
    data.copy(payload, 1);

    const ocf = HciOcfLeControllerCommands.SetAdvertisingData;
    await this.sendLeCommand(ocf, payload);
  }

  public async leSetScanResponseData(data: Buffer): Promise<void> {
    if (data.length > 31) {
      throw this.makeHciError(HciErrorCode.InvalidCommandParameter);
    }

    const payload = Buffer.alloc(1+31, 0);
    payload.writeUInt8(data.length, 0);
    data.copy(payload, 1);

    const ocf = HciOcfLeControllerCommands.SetScanResponseData;
    await this.sendLeCommand(ocf, payload);
  }

  public async leSetAdvertisingEnable(enable: boolean): Promise<void> {
    const payload = Buffer.allocUnsafe(1);
    payload.writeUInt8(enable ? 1 : 0);
    const ocf = HciOcfLeControllerCommands.SetAdvertisingEnable;
    await this.sendLeCommand(ocf, payload);
  }

  public async leSetScanEnable(enable: boolean, filterDuplicates?: boolean): Promise<void> {
    const payload = Buffer.allocUnsafe(2);
    payload.writeUInt8(enable           ? 1 : 0);
    payload.writeUInt8(filterDuplicates ? 1 : 0);
    const ocf = HciOcfLeControllerCommands.SetScanEnable;
    await this.sendLeCommand(ocf, payload);
  }

  public async leCreateConnectionCancel(): Promise<void> {
    const ocf = HciOcfLeControllerCommands.CreateConnectionCancel;
    await this.sendLeCommand(ocf);
  }

  public async leReadWhiteListSize(): Promise<number> {
    const ocf = HciOcfLeControllerCommands.ReadWhiteListSize;
    const result = await this.sendLeCommand(ocf);

    if (result.returnParameters.length < 1) {
      throw this.makeError(HciParserError.InvalidPayloadSize);
    }
    return result.returnParameters.readUInt8(0);
  }

  public async leClearWhiteList(): Promise<void> {
    await this.sendLeCommand(HciOcfLeControllerCommands.ClearWhiteList);
  }

  public async leReadSupportedStates(): Promise<LeSupportedStates> {
    const ocf = HciOcfLeControllerCommands.ReadSupportedStates;
    const result = await this.sendLeCommand(ocf);

    const params = result.returnParameters;
    if (params.length < (64/8)) {
      throw this.makeError(HciParserError.InvalidPayloadSize);
    }
    const bitmask = params.readBigUInt64LE(0);
    return LeSupportedStates.fromBitmask(bitmask);
  }

  public async leReadSuggestedDefaultDataLength(): Promise<{
    suggestedMaxTxOctets: number, suggestedMaxTxTime: number,
  }> {
    const ocf = HciOcfLeControllerCommands.ReadSuggestedDefaultDataLength;
    const result = await this.sendLeCommand(ocf);

    const params = result.returnParameters;
    if (params.length < 4) {
      throw this.makeError(HciParserError.InvalidPayloadSize);
    }
    return {
      suggestedMaxTxOctets: params.readUInt16LE(0),
      suggestedMaxTxTime:   params.readUInt16LE(2)
    };
  }

  public async leWriteSuggestedDefaultDataLength(params: {
    suggestedMaxTxOctets: number,
    suggestedMaxTxTime: number,
  }): Promise<void> {
    const payload = Buffer.allocUnsafe(4);
    payload.writeUInt16LE(params.suggestedMaxTxOctets, 0);
    payload.writeUInt16LE(params.suggestedMaxTxTime,   2);
    const ocf = HciOcfLeControllerCommands.WriteSuggestedDefaultDataLength;
    await this.sendLeCommand(ocf, payload);
  }

  public async leClearResolvingList(): Promise<void> {
    await this.sendLeCommand(HciOcfLeControllerCommands.ClearResolvingList);
  }

  public async leReadResolvingListSize(): Promise<number> {
    const ocf = HciOcfLeControllerCommands.ReadResolvingListSize;
    const result = await this.sendLeCommand(ocf);
    if (result.returnParameters.length < 1) {
      throw this.makeError(HciParserError.InvalidPayloadSize);
    }
    return result.returnParameters.readUInt8(0);
  }

  public async leReadMaximumDataLength(): Promise<{
    supportedMaxTxOctets: number, supportedMaxTxTime: number,
    supportedMaxRxOctets: number, supportedMaxRxTime: number,
  }> {
    const ocf = HciOcfLeControllerCommands.ReadMaximumDataLength;
    const result = await this.sendLeCommand(ocf);
    const params = result.returnParameters;

    if (params.length < 8) {
      throw this.makeError(HciParserError.InvalidPayloadSize);
    }
    return {
      supportedMaxTxOctets: params.readUInt16LE(0),
      supportedMaxTxTime:   params.readUInt16LE(2),
      supportedMaxRxOctets: params.readUInt16LE(4),
      supportedMaxRxTime:   params.readUInt16LE(6),
    };
  }

  public async leReadPhy(connectionHandle: number): Promise<{
    connectionHandle: number,
    txPhy: LePhy,
    rxPhy: LePhy,
  }> {
    const payload = Buffer.allocUnsafe(2);
    payload.writeUInt16LE(connectionHandle, 0);

    const ocf = HciOcfLeControllerCommands.ReadPhy;
    const result = await this.sendLeCommand(ocf, payload);
    const params = result.returnParameters;

    if (params.length < 4) {
      throw this.makeError(HciParserError.InvalidPayloadSize);
    }
    return {
      connectionHandle: params.readUInt16LE(0),
      txPhy:            params.readUInt8(2),
      rxPhy:            params.readUInt8(3),
    };
  }

  public async leSetDefaultPhy(params: {
    txPhys?: LePhy, rxPhys?: LePhy,
  }): Promise<void> {
    let allPhys = 0, txPhys = 0, rxPhys = 0;

    // Is there ps reference for tx/rx phy?
    if (params.txPhys === undefined) {
      allPhys |= (1 << 0);
    } else {
      txPhys = 1 << params.txPhys;
    }
    if (params.rxPhys === undefined) {
      allPhys |= (1 << 1);
    } else {
      rxPhys = 1 << params.rxPhys;
    }

    const payload = Buffer.allocUnsafe(3);

    let o = 0;
    o = payload.writeUInt8(allPhys, o);
    o = payload.writeUInt8(txPhys,  o);
    o = payload.writeUInt8(rxPhys,  o);

    const ocf = HciOcfLeControllerCommands.SetDefaultPhy;
    await this.sendLeCommand(ocf, payload);
  }

  public async leSetAdvertisingSetRandomAddress(params: {
    advertisingHandle: number,
    advertisingRandomAddress: number,
  }): Promise<void> {
    const payload = Buffer.allocUnsafe(7);

    let o = 0;
    o = payload.writeUIntLE(params.advertisingHandle,        o, 1);
    o = payload.writeUIntLE(params.advertisingRandomAddress, o, 6);

    const ocf = HciOcfLeControllerCommands.SetAdvertisingSetRandomAddress;
    await this.sendLeCommand(ocf, payload);
  }

  public async leSetExtendedAdvertisingParameters(params: {
    advertisingHandle: number,
    advertisingEventProperties: LeAdvertisingEventProperties[],
    primaryAdvertisingIntervalMinMs: number,
    primaryAdvertisingIntervalMaxMs: number,
    primaryAdvertisingChannelMap: LeAdvertisingChannelMap[],
    ownAddressType: LeOwnAddressType,
    peerAddressType: LePeerAddressType,
    peerAddress: number,
    advertisingFilterPolicy: LeAdvertisingFilterPolicy,
    advertisingTxPower?: number,
    primaryAdvertisingPhy: LePrimaryAdvertisingPhy,
    secondaryAdvertisingMaxSkip: number,
    secondaryAdvertisingPhy: LeSecondaryAdvertisingPhy,
    advertisingSid: number,
    scanRequestNotificationEnable: boolean,
  }): Promise<number> {

    const advertisingEventProperties    = this.buildBitfield(params.advertisingEventProperties);
    const primaryAdvertisingIntervalMin = Math.round(params.primaryAdvertisingIntervalMinMs / 0.625);
    const primaryAdvertisingIntervalMax = Math.round(params.primaryAdvertisingIntervalMaxMs / 0.625);
    const primaryAdvertisingChannelMap  = this.buildBitfield(params.primaryAdvertisingChannelMap);
    const advertisingTxPower            = params.advertisingTxPower ?? 0x7F; // 0x7F - Host has no preference
    const scanRequestNotificationEnable = params.scanRequestNotificationEnable ? 1 : 0;

    const payload = Buffer.allocUnsafe(25);

    let o = 0;
    o = payload.writeUIntLE(params.advertisingHandle,             o, 1);
    o = payload.writeUIntLE(advertisingEventProperties,           o, 2);
    o = payload.writeUIntLE(primaryAdvertisingIntervalMin,        o, 3);
    o = payload.writeUIntLE(primaryAdvertisingIntervalMax,        o, 3);
    o = payload.writeUIntLE(primaryAdvertisingChannelMap,         o, 1);
    o = payload.writeUIntLE(params.ownAddressType,                o, 1);
    o = payload.writeUIntLE(params.peerAddressType,               o, 1);
    o = payload.writeUIntLE(params.peerAddress,                   o, 6);
    o = payload.writeUIntLE(params.advertisingFilterPolicy,       o, 1);
    o = payload.writeIntLE (advertisingTxPower,                   o, 1);
    o = payload.writeUIntLE(params.primaryAdvertisingPhy,         o, 1);
    o = payload.writeUIntLE(params.secondaryAdvertisingMaxSkip,   o, 1);
    o = payload.writeUIntLE(params.secondaryAdvertisingPhy,       o, 1);
    o = payload.writeUIntLE(params.advertisingSid,                o, 1);
    o = payload.writeUIntLE(scanRequestNotificationEnable,        o, 1);

    const ocf = HciOcfLeControllerCommands.SetExtendedAdvertisingParameters;
    const result = await this.sendLeCommand(ocf, payload);

    if (result.returnParameters.length < 1) {
      throw this.makeError(HciParserError.InvalidPayloadSize);
    }

    const selectedTxPower = result.returnParameters.readInt8(0);
    return selectedTxPower;
  }

  public async leSetExtendedAdvertisingData(params: {
    advertisingHandle: number,
    operation: LeAdvertisingDataOperation,
    fragment: boolean,
    data: Buffer,
  }): Promise<void> {
    const payload = Buffer.allocUnsafe(4 + params.data.length);

    let o = 0;
    o = payload.writeUIntLE(params.advertisingHandle,  o, 1);
    o = payload.writeUIntLE(params.operation,          o, 1);
    o = payload.writeUIntLE(params.fragment ? 0 : 1,   o, 1);
    o = payload.writeUIntLE(params.data.length,        o, 1);
    params.data.copy(payload, o);

    const ocf = HciOcfLeControllerCommands.SetExtendedAdvertisingData;
    await this.sendLeCommand(ocf, payload);
  }

  public async leSetExtendedScanResponseData(params: {
    advertisingHandle: number,
    operation: LeScanResponseDataOperation,
    fragment: boolean,
    data: Buffer,
  }): Promise<void> {
    const payload = Buffer.allocUnsafe(4 + params.data.length);

    let o = 0;
    o = payload.writeUIntLE(params.advertisingHandle,  o, 1);
    o = payload.writeUIntLE(params.operation,          o, 1);
    o = payload.writeUIntLE(params.fragment ? 0 : 1,   o, 1);
    o = payload.writeUIntLE(params.data.length,        o, 1);
    params.data.copy(payload, o);

    const ocf = HciOcfLeControllerCommands.SetExtendedScanResponseData;
    await this.sendLeCommand(ocf, payload);
  }

  public async leReadNumberOfSupportedAdvertisingSets(): Promise<number> {
    const ocf = HciOcfLeControllerCommands.ReadNumberOfSupportedAdvertisingSets;
    const result = await this.sendLeCommand(ocf);
    if (result.returnParameters.length < 1) {
      throw this.makeError(HciParserError.InvalidPayloadSize);
    }
    return result.returnParameters.readUInt8(0);
  }

  public async leSetExtendedScanParameters(params: {
    ownAddressType: LeOwnAddressType,
    scanningFilterPolicy: LeScanningFilterPolicy,
    scanningPhy: {
      Phy1M?:    { type: LeScanType, intervalMs: number, windowMs: number },
      PhyCoded?: { type: LeScanType, intervalMs: number, windowMs: number },
    },
  }): Promise<void> {
    const phys = { count: 0, bitmask: 0 };

    if (params.scanningPhy.Phy1M) {
      phys.count++;
      phys.bitmask |= 1 << LeScanningPhy.Phy1M;
    }
    if (params.scanningPhy.PhyCoded) {
      phys.count++;
      phys.bitmask |= 1 << LeScanningPhy.PhyCoded;
    }

    if (phys.count === 0) {
      throw this.makeHciError(HciErrorCode.InvalidCommandParameter);
    }

    const payload = Buffer.allocUnsafe(3 + phys.count * (1+2+2));

    let o = 0;
    o = payload.writeUIntLE(params.ownAddressType,       o, 1);
    o = payload.writeUIntLE(params.scanningFilterPolicy, o, 1);
    o = payload.writeUIntLE(phys.bitmask,                o, 1);

    if (params.scanningPhy.Phy1M) {
      o = payload.writeUIntLE(params.scanningPhy.Phy1M.type, o, 1);
    }
    if (params.scanningPhy.PhyCoded) {
      o = payload.writeUIntLE(params.scanningPhy.PhyCoded.type, o, 1);
    }
    if (params.scanningPhy.Phy1M) {
      const interval = this.msToHciValue(params.scanningPhy.Phy1M.intervalMs);
      o = payload.writeUIntLE(interval, o, 2);
    }
    if (params.scanningPhy.PhyCoded) {
      const interval = this.msToHciValue(params.scanningPhy.PhyCoded.intervalMs);
      o = payload.writeUIntLE(interval, o, 2);
    }
    if (params.scanningPhy.Phy1M) {
      const window = this.msToHciValue(params.scanningPhy.Phy1M.windowMs);
      o = payload.writeUIntLE(window, o, 2);
    }
    if (params.scanningPhy.PhyCoded) {
      const window = this.msToHciValue(params.scanningPhy.PhyCoded.windowMs);
      o = payload.writeUIntLE(window, o, 2);
    }

    const ocf = HciOcfLeControllerCommands.SetExtendedScanParameters;
    await this.sendLeCommand(ocf, payload);
  }

  public async leSetExtendedScanEnable(params: {
    enable: boolean,
    filterDuplicates: LeScanFilterDuplicates,
    durationMs?: number,
    periodSec?: number,
  }): Promise<void> {
    const duration = Math.round((params.durationMs ?? 0) / 10);
    const period = Math.round((params.periodSec ?? 0) / 1.28);

    const payload = Buffer.allocUnsafe(1+1+2+2);

    let o = 0;
    o = payload.writeUIntLE(params.enable ? 1 : 0,   o, 1);
    o = payload.writeUIntLE(params.filterDuplicates, o, 1);
    o = payload.writeUIntLE(duration,                o, 2);
    o = payload.writeUIntLE(period,                  o, 2);

    const ocf = HciOcfLeControllerCommands.SetExtendedScanEnable;
    await this.sendLeCommand(ocf, payload);
  }

  private async sendLeCommand(ocf: HciOcfLeControllerCommands, payload?: Buffer): Promise<HciEvtCmdComplete> {
    return await this.send({
      opcode: HciOpcode.build({
        ogf: HciOgf.LeControllerCommands, ocf,
      }),
      params: payload,
    });
  }

  private msToHciValue(ms: number): number {
    return Math.round(ms / 0.625);
  }
  private hciValueToMs(val: number): number {
    return val * 0.625;
  }

  private buildBitfield(bits: number[]): number {
    let bitfield = 0;
    for (const bit of bits) {
      bitfield |= 1 << bit;
    }
    return bitfield;
  }

  private async send(cmd: HciCommand): Promise<HciEvtCmdComplete> {
    return new Promise<HciEvtCmdComplete>((resolve, reject) => {
      if (this.onCmdComplete !== null) {
        return reject(this.makeError(HciParserError.Busy));
      }
      const complete = (err?: Error, evt?: HciEvtCmdComplete) => {
        clearTimeout(timeoutId);
        this.onCmdComplete = null;
        err ? reject(err) : resolve(evt!);
      };
      const timeoutId = setTimeout(
        () => complete(this.makeError(HciParserError.Timeout)), this.cmdTimeout
      );
      this.onCmdComplete = (evt: HciEvtCmdComplete) => {
        console.log(JSON.stringify(evt, null, 2), HciOpcode.expand(evt.opcode));
        if (this.cmdOpcode !== evt.opcode) {
          return;
        }
        if (evt.status === HciErrorCode.Success) {
          complete(undefined, evt);
        } else {
          complete(this.makeHciError(evt.status));
        }
      };
      this.cmdOpcode = cmd.opcode;
      this.sendRaw(this.buildBuffer(cmd));
    });
  }

  private makeHciError(code: HciErrorCode): HciError {
    return new HciError(code);
  }

  private makeError(code: HciParserError): Error {
    if (code === HciParserError.InvalidPayloadSize) {
      return new Error(`Cannot parse payload, invalid size`);
    }
    if (code === HciParserError.Busy) {
      return new Error(`Busy, command in progress.`)
    }
    if (code === HciParserError.Timeout) {
      return new Error(`Command timeout`);
    }
    return new Error(`Unexpected error`);
  }

  private buildBuffer(cmd: HciCommand): Buffer {
    const payloadLength = cmd.params?.length ?? 0;
    const buffer = Buffer.allocUnsafe(3 + payloadLength);
    buffer.writeUInt16LE(cmd.opcode, 0);
    buffer.writeUInt8(payloadLength, 2);
    if (cmd.params && payloadLength > 0) {
      cmd.params.copy(buffer, 3);
    }
    return buffer;
  }

  private onData(data: Buffer): void {
    console.log(data);
    if (data.length < 2) {
      debug(`hci event - invalid size ${data.length}`);
      return;
    }

    const eventCode     = data[0];
    const payloadLength = data[1];
    const payload       = data.slice(2);

    if (payloadLength !== payload.length) {
      this.emit('parser-error', `(evt) invalid payload size: ${payloadLength}/${payload.length}`);
      return;
    }

    switch (eventCode) {
      case HciEventCode.HCI_EVT_CMD_COMPLETE:
        if (payload.length < 4) {
          this.emit('parser-error', `(evt-cmd_complete) invalid payload size: ${payload.length}`);
          return;
        }
        if (this.onCmdComplete) {
          this.onCmdComplete({
            numHciPackets: payload[0],
            opcode: payload.readUInt16LE(1),
            status: payload[3],
            returnParameters: payload.slice(4),
          });
        }
        break;
    }
  }
}
