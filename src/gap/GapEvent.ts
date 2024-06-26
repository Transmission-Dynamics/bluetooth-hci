import type { DisconnectionCompleteEvent as HciDisconnectionCompleteEvent } from "../hci/HciEvent";
import type { GapDeviceInfo } from "./GapCentral";

export interface DisconnectionCompleteEvent extends HciDisconnectionCompleteEvent {
  device: GapDeviceInfo;
}
