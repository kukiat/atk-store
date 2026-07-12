import "server-only";

import type { IotNormalizedLoadcellEvent } from "@/services/iot-loadcell-contract";
import { iotSessionService } from "@/services/iot-session.service";

export type ProcessIotEventResult = {
  status: "processed";
  eventType: IotNormalizedLoadcellEvent["type"];
  sessionId: string;
};

class IotEventProcessorService {
  async process(
    event: IotNormalizedLoadcellEvent,
  ): Promise<ProcessIotEventResult> {
    if (event.type === "picked_count") {
      const session = await iotSessionService.applyPickedCount({
        sessionId: event.sessionId,
        inventoryId: event.inventoryId,
        pickedCount: event.pickedCount,
        currentQty: event.currentQty,
        seq: event.seq,
        occurredAt: event.occurredAt,
        rawPayload: event.rawPayload,
      });
      return {
        status: "processed",
        eventType: event.type,
        sessionId: session.sessionId,
      };
    }

    const session = await iotSessionService.closeDoor({
      sessionId: event.sessionId,
      inventoryId: event.inventoryId,
      seq: event.seq,
      occurredAt: event.occurredAt,
      rawPayload: event.rawPayload,
    });

    return {
      status: "processed",
      eventType: event.type,
      sessionId: session.sessionId,
    };
  }
}

export const iotEventProcessorService = new IotEventProcessorService();
