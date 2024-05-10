import { Request } from "express";
export type SOS = `${"same" | "opposite"} side`
export type LRS = "right" | "left" | "straight";
export type DD = 0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9;
export type D1 = 1;
export type D2 = D1 | 2;
export type D3 = D2 | 3;
export type D4 = D3 | 4;
export type D5 = D4 | 5;
export type D6 = D5 | 6;
export type D7 = D6 | 7;
export type D8 = D7 | 8;
export type D9 = D8 | 9;
export type D0 = D9 | 0;
export type RoomID = `${D3}-${D9}` | `${D3}-${"E"|"R"}${D9}` | `${D3}-${D7}${D0}`
export type HallID = `${D3}${'A'|'B'|'C'|'D'|'E'|'F'}`
export type Compass = "AUDITORIUM" | "END WING" | "FRONT" | "BUS LOOP"
export type DirectionsKey = `${RoomID},${RoomID}`;
export type Directions = {
  [k in DirectionsKey]: string;
};
export type HallsHalls = {
  [k in RoomID]: HallID[]
}
export type HallsValue = {
  parent: RoomID,
  direction: [Compass, Compass],
  children: [RoomID, DD][],
  "md-children": RoomID[],
  "hall-children": RoomID[]
}
export type Halls = {
  [k in HallID]: HallsValue
}
export type Relations = {
  [k in RoomID]: RoomID[]
}
export type RoomsHalls = {
  [k in RoomID]: HallID
}
export type HallsRooms = {
  [k in HallID]: RoomID
}
export type Rooms = {
  [k in RoomID]: string | number | [number, number]
}
export type FlippedRooms = {
  [k in string | number]: RoomID
}
export type Shortcut = {
  from: number,
  to : number,
  directions: [LRS, SOS, string | number],
  from_door: false | string
}
export namespace U {
  export type Spans = {[k in HallID]: number}
  export type Visited = {[k in RoomID]: true}
}