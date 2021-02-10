export enum LeState {
  ScanUndirectAdv,
  ConnScanUndirectAdv,
  NonConnNonScanUndirectAdv,
  HighDutyConnDirectAdv,
  LowDutyConnDirectAdv,
  ActiveScanning,
  PassiveScanning,
  Initiating,
  ConnectionMasterRole,
  ConnectionSlaveRole,
}

export const LeStateNames = [
  'Scannable Undirected Advertising State',
  'Connectable and Scannable Undirected Advertising State',
  'Non-connectable and Non-Scannable Undirected Advertising State',
  'High Duty Cycle Connectable Directed Advertising State',
  'Low Duty Cycle Connectable Directed Advertising State',
  'Active Scanning State',
  'Passive Scanning State',
  'Initiating State',
  'Connection State (Master Role)',
  'Connection State (Slave Role)'
];

export const LeAllowedStates: LeState[][] = [
  [LeState.NonConnNonScanUndirectAdv                              ], // bit0
  [LeState.ScanUndirectAdv                                        ], // bit1
  [LeState.ConnScanUndirectAdv                                    ], // bit2
  [LeState.HighDutyConnDirectAdv                                  ], // bit3
  [LeState.PassiveScanning                                        ], // bit4
  [LeState.ActiveScanning                                         ], // bit5
  [LeState.Initiating                                             ], // bit6
  [LeState.ConnectionSlaveRole                                    ], // bit7
  [LeState.NonConnNonScanUndirectAdv, LeState.PassiveScanning     ], // bit8
  [LeState.ScanUndirectAdv,           LeState.PassiveScanning     ], // bit9
  [LeState.ConnScanUndirectAdv,       LeState.PassiveScanning     ], // bit10
  [LeState.HighDutyConnDirectAdv,     LeState.PassiveScanning     ], // bit11
  [LeState.NonConnNonScanUndirectAdv, LeState.ActiveScanning      ], // bit12
  [LeState.ScanUndirectAdv,           LeState.ActiveScanning      ], // bit13
  [LeState.ConnScanUndirectAdv,       LeState.ActiveScanning      ], // bit14
  [LeState.HighDutyConnDirectAdv,     LeState.ActiveScanning      ], // bit15
  [LeState.NonConnNonScanUndirectAdv, LeState.Initiating          ], // bit16
  [LeState.ScanUndirectAdv,           LeState.Initiating          ], // bit17
  [LeState.NonConnNonScanUndirectAdv, LeState.ConnectionMasterRole], // bit18
  [LeState.ScanUndirectAdv,           LeState.ConnectionMasterRole], // bit19
  [LeState.NonConnNonScanUndirectAdv, LeState.ConnectionSlaveRole ], // bit20
  [LeState.ScanUndirectAdv,           LeState.ConnectionSlaveRole ], // bit21
  [LeState.PassiveScanning,           LeState.Initiating          ], // bit22
  [LeState.ActiveScanning,            LeState.Initiating          ], // bit23
  [LeState.PassiveScanning,           LeState.ConnectionMasterRole], // bit24
  [LeState.ActiveScanning,            LeState.ConnectionMasterRole], // bit25
  [LeState.PassiveScanning,           LeState.ConnectionSlaveRole ], // bit26
  [LeState.ActiveScanning,            LeState.ConnectionSlaveRole ], // bit27
  [LeState.Initiating,                LeState.ConnectionMasterRole], // bit28
  [LeState.LowDutyConnDirectAdv                                   ], // bit29
  [LeState.LowDutyConnDirectAdv,      LeState.PassiveScanning     ], // bit30
  [LeState.LowDutyConnDirectAdv,      LeState.ActiveScanning      ], // bit31
  [LeState.ConnScanUndirectAdv,       LeState.Initiating          ], // bit32
  [LeState.HighDutyConnDirectAdv,     LeState.Initiating          ], // bit33
  [LeState.LowDutyConnDirectAdv,      LeState.Initiating          ], // bit34
  [LeState.ConnScanUndirectAdv,       LeState.ConnectionMasterRole], // bit35
  [LeState.HighDutyConnDirectAdv,     LeState.ConnectionMasterRole], // bit36
  [LeState.LowDutyConnDirectAdv,      LeState.ConnectionMasterRole], // bit37
  [LeState.ConnScanUndirectAdv,       LeState.ConnectionSlaveRole ], // bit38
  [LeState.HighDutyConnDirectAdv,     LeState.ConnectionSlaveRole ], // bit39
  [LeState.LowDutyConnDirectAdv,      LeState.ConnectionSlaveRole ], // bit40
  [LeState.Initiating,                LeState.ConnectionSlaveRole ], // bit41
];

export class LeSupportedStates {
  public readonly states: LeState[][];

  private constructor(states: LeState[][]) {
    this.states = states;
  }

  public static fromBitmask(bitmask: bigint): LeSupportedStates{
    const states: LeState[][] = [];
    for (let b = 0n; b <= 41n; b++) {
      if ((bitmask & (1n << b)) !== 0n) {
        states.push(LeAllowedStates[Number(b)]);
      }
    }
    return new LeSupportedStates(states);
  }

  public toString(): string[][] {
    const strStates: string[][] = [];
    for (const state of this.states) {
      strStates.push(state.map((e) => LeStateNames[e]));
    }
    return strStates;
  }
}

export enum LePhy {
  Phy1M    = 0,
  Phy2M    = 1,
  PhyCoded = 2,
}

export enum LeTxPhy {
  Phy1M      = 0x01, // Transmitter set to use the LE 1M PHY
  Phy2M      = 0x02, // Transmitter set to use the LE 2M PHY
  PhyCodedS8 = 0x03, // Transmitter set to use the LE Coded PHY with S=8 data coding
  PhyCodedS2 = 0x04, // Transmitter set to use the LE Coded PHY with S=2 data coding
}

export enum LeAdvertisingType {
  // Connectable and scannable undirected advertising (ADV_IND) (default)
  Undirected            = 0,
  // Connectable high duty cycle directed advertising (ADV_DIRECT_IND, high duty cycle)
  DirectedHighDutyCycle = 1,
  // Scannable undirected advertising (ADV_SCAN_IND)
  Scannable             = 2,
  // Non connectable undirected advertising (ADV_NONCONN_IND)
  NonConnectable        = 3,
  // Connectable low duty cycle directed advertising (ADV_DIRECT_IND, low duty cycle)
  DirectedLowDutyCycle  = 4,
}

export enum LeAdvertisingEventProperties {
  Connectable                      = 0, // Connectable advertising
  Scannable                        = 1, // Scannable advertising
  Directed                         = 2, // Directed advertising
  HighDutyCycleDirectedConnectable = 3, // High Duty Cycle Directed Connectable advertising 
                                        // (≤ 3.75 ms Advertising Interval)
  UseLegacyPDUs                    = 4, // Use legacy advertising PDUs
  AnonymousAdvertising             = 5, // Omit advertiser's address from all PDUs ("anonymous advertising")
  IncludeTxPower                   = 6, // Include TxPower in the extended header of at least one advertising PDU
}

export enum LeAdvertisingChannelMap {
  Channel37 = 0, // Channel 37 shall be used
  Channel38 = 1, // Channel 38 shall be used
  Channel39 = 2, // Channel 39 shall be used
}

export enum LeOwnAddressType {
  PublicDeviceAddress,          // Public Device Address
  RandomDeviceAddress,          // Random Device Address
  UsePublicAddressIfNoMatching, // Controller generates the Resolvable Private Address based on the local
                                // IRK from the resolving list. If the resolving list contains no matching
                                // entry, use the public address.
  UseRandomAddressIfNoMatching, // Controller generates the Resolvable Private Address based on the local
                                // IRK from the resolving list. If the resolving list contains no matching
                                // entry, use the random address from LE_Set_Advertising_Set_Random_
                                // Address.
}

export enum LePeerAddressType {
  PublicDeviceAddress, // Public Device Address or Public Identity Address
  RandomDeviceAddress, // Random Device Address or Random (static) Identity Address
}

export enum LeWhiteListAddressType {
  Public,
  Random,
  Anonymous,
}

export enum LeAdvertisingFilterPolicy {
  Any,                  // Process scan and connection requests from all devices (i.e., the White
                        // List is not in use)
  WhiteListConnect,     // Process connection requests from all devices and scan requests only
                        // from devices that are in the White List.
  WhiteListScan,        // Process scan requests from all devices and connection requests only
                        // from devices that are in the White List.
  WhiteListScanConnect, // Process scan and connection requests only from devices in the White
                        // List.
}

export enum LePrimaryAdvertisingPhy {
  Phy1M    = 0x01, // Primary advertisement PHY is LE 1M
  PhyCoded = 0x03, // Primary advertisement PHY is LE Coded
}

export enum LeSecondaryAdvertisingPhy {
  Phy1M    = 0x01, // Secondary advertisement PHY is LE 1M
  Phy2M    = 0x02, // Secondary advertisement PHY is LE 2M
  PhyCoded = 0x03, // Secondary advertisement PHY is LE Coded
}

export enum LeAdvertisingDataOperation {
  FragmentIntermediate  = 0x00, // Intermediate fragment of fragmented extended advertising data
  FragmentFirst         = 0x01, // First fragment of fragmented extended advertising data
  FragmentLast          = 0x02, // Last fragment of fragmented extended advertising data
  Complete              = 0x03, // Complete extended advertising data
  Unchanged             = 0x04, // Unchanged data (just update the Advertising DID)
}

export enum LeScanResponseDataOperation {
  FragmentIntermediate  = 0x00, // Intermediate fragment of fragmented extended advertising data
  FragmentFirst         = 0x01, // First fragment of fragmented extended advertising data
  FragmentLast          = 0x02, // Last fragment of fragmented extended advertising data
}

export enum LeScanningFilterPolicy {
  // Accept all advertising and scan response PDUs except directed advertising
  // PDUs not addressed to this device
  All = 0x00,

  // Accept only advertising and scan response PDUs from devices where
  // the advertiser’s address is in the White List. Directed advertising PDUs
  // which are not addressed to this device shall be ignored.
  FromWhiteList = 0x01,

  // Accept all advertising and scan response PDUs except directed advertising
  // PDUs where the identity address corresponding to TargetA does
  // not address this device.
  // Note: Directed advertising PDUs where the TargetA is a resolvable private
  // address that cannot be resolved are also accepted.
  AllExceptDirectedAdvertisingPackets = 0x02,

  // Accept all advertising and scan response PDUs except:
  // • advertising and scan response PDUs where the advertiser’s identity
  // address is not in the White List; and
  // • directed advertising PDUs where the identity address corresponding
  // to TargetA does not address this device.
  // Note: Directed advertising PDUs where TargetA is a resolvable private
  // address that cannot be resolved are also accepted.
  AllExceptPacketFromWhiteListAndDirectedAdvertising = 0x03,
}

export enum LeScanningPhy {
  Phy1M    = 0x00, // Scan advertisements on the LE 1M PHY
  PhyCoded = 0x02, // Scan advertisements on the LE Coded PHY
}

export enum LeScanType {
  Passive = 0x00, // Passive Scanning. No scan request PDUs shall be sent.
  Active  = 0x01, // Active Scanning. Scan request PDUs may be sent.
}

export enum LeScanFilterDuplicates {
  Disabled = 0x00, // Duplicate filtering disabled
  Enabled  = 0x01, // Duplicate filtering enabled
  Reset    = 0x02, // Duplicate filtering enabled, reset for each scan period
}

export enum LeModulationIndex {
  Standard = 0, // Assume transmitter will have a standard modulation index
  Stable   = 1, // Assume transmitter will have a stable modulation index
}

export enum LeCteType {
  AoAConstatTone     = 0x00, // Expect AoA Constant Tone Extension
  AoDConstantTone1us = 0x01, // Expect AoD Constant Tone Extension with 1 μs slots
  AoDConstantTone2us = 0x02, // Expect AoD Constant Tone Extension with 2 μs slots
}

export enum LeTxTestPayload {
  SequencePRBS9     = 0x00, // PRBS9 sequence '11111111100000111101…' (in transmission order) as
                            // described in [Vol 6] Part F, Section 4.1.5
  Sequence11110000  = 0x01, // Repeated '11110000' (in transmission order) sequence as described in
                            // [Vol 6] Part F, Section 4.1.5
  Sequence10101010  = 0x02, // Repeated '10101010' (in transmission order) sequence as described in
                            // [Vol 6] Part F, Section 4.1.5
  SequencePRBS15    = 0x03, // PRBS15 sequence as described in [Vol 6] Part F, Section 4.1.5
  Sequence11111111  = 0x04, // Repeated '11111111' (in transmission order) sequence
  Sequence00000000  = 0x05, // Repeated '00000000' (in transmission order) sequence
}

export type LeMinTransmitPowerLevel = 0x7E; // Set transmitter to minimum transmit power level
export type LeMaxTransmitPowerLevel = 0x7F; // Set transmitter to maximum transmit power level