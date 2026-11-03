// Passive copper ceilings for a home cable, in metres. DeskLab stores a cable
// family, not the exact HDMI / DP / USB generation, so each number is a
// conservative generic ceiling for that family: long enough that a normal
// passive cable is not flagged, short of the lengths that need an active or
// fiber cable. Power and analog audio are not in this table.
//
// hdmi, 3 m. HDMI 2.1's full 48 Gbps rate over passive copper is commonly
// qualified to about 3 m (HDMI Licensing Administrator, Ultra High Speed
// HDMI Cable program). Longer full-bandwidth runs use an active or fiber cable.
// displayport, 3 m. VESA DisplayPort 1.4 passive HBR3 copper is commonly
// specified to about 3 m. DisplayPort 2.1 UHBR passive cables are shorter.
// usb_c, 2 m. USB-IF USB Type-C Cable and Connector Specification: a passive
// USB 3.2 Gen 1 (5 Gbps) assembly is at most 2 m. Gen 2 is 1 m, and USB4
// Gen 3 / Thunderbolt 3 and 4 passive cables are 0.8 m (USB-IF and Intel).
// 2 m is the generic ceiling when the generation is unknown.
// usb, 3 m. USB 3.x passive cables are commonly limited to about 3 m
// (USB-IF USB 3.2). USB 2.0 passive may reach 5 m. The catalog's USB-A port
// does not say which, so the warning uses the tighter high-speed ceiling.
// ethernet, 100 m. TIA-568 and ISO/IEC 11801 channel length.
export const PASSIVE_CABLE_LIMITS = Object.freeze({
  hdmi: Object.freeze({ maxMetres: 3, label: 'HDMI' }),
  displayport: Object.freeze({ maxMetres: 3, label: 'DP' }),
  usb_c: Object.freeze({ maxMetres: 2, label: 'USB-C' }),
  usb: Object.freeze({ maxMetres: 3, label: 'USB' }),
  ethernet: Object.freeze({ maxMetres: 100, label: '网线' }),
});

export function passiveCableLimit(cableType) {
  return PASSIVE_CABLE_LIMITS[cableType] ?? null;
}
