import type { JeepneySimulationConfig } from "../sim/types";

export type RouteStopLayout = {
  stopId: string;
  x: number;
  y: number;
  labelDx?: number;
  labelDy?: number;
};

export type MakatiRoad = {
  id: string;
  name: string;
  path: string;
  labelX: number;
  labelY: number;
  tone: "primary" | "secondary" | "local";
};

export type MapLabel = {
  id: string;
  name: string;
  x: number;
  y: number;
  kind: "district" | "landmark";
};

export type TrafficSegment = {
  id: string;
  fromStopId: string;
  toStopId: string;
  path: string;
  label: string;
  labelX: number;
  labelY: number;
};

export const jeepneyDemoConfig: JeepneySimulationConfig = {
  route: {
    id: "prc-buendia-chino-roces-corridor",
    name: "PRC to Buendia via Chino Roces",
    stops: [
      { id: "prc-terminal", name: "PRC Terminal" },
      { id: "ap-reyes", name: "A.P. Reyes" },
      { id: "pablo-ocampo", name: "P. Ocampo / Shopwise" },
      { id: "yakal", name: "Yakal" },
      { id: "gil-puyat", name: "Gil Puyat" }
    ]
  },
  jeepneys: [
    { id: "j1", label: "J1", initialStopIndex: 0 },
    { id: "j2", label: "J2", initialStopIndex: 1 },
    { id: "j3", label: "J3", initialStopIndex: 2 },
    { id: "j4", label: "J4", initialStopIndex: 4 }
  ],
  ticks: 12,
  timeQuantum: 2,
  agingEnabled: true,
  agingThreshold: 5,
  passengerArrivalRate: 2,
  passengerBoardingRate: 4
};

export const jeepneyRoutePath =
  "M492 56 C478 76 466 92 454 110 C442 136 434 154 428 168 C418 190 412 206 410 226 C408 240 410 252 420 258 C396 268 360 276 288 286";

export const jeepneyRouteLayout: RouteStopLayout[] = [
  { stopId: "prc-terminal", x: 492, y: 56, labelDx: 0, labelDy: -28 },
  { stopId: "ap-reyes", x: 454, y: 110, labelDx: 68, labelDy: -2 },
  { stopId: "pablo-ocampo", x: 428, y: 168, labelDx: -94, labelDy: -10 },
  { stopId: "yakal", x: 410, y: 226, labelDx: 58, labelDy: -4 },
  { stopId: "gil-puyat", x: 288, y: 286, labelDx: 56, labelDy: -10 }
];

export const makatiRoads: MakatiRoad[] = [
  {
    id: "ap-reyes",
    name: "A.P. Reyes Ave",
    path: "M532 58 C502 74 478 90 454 110",
    labelX: 496,
    labelY: 84,
    tone: "primary"
  },
  {
    id: "pablo-ocampo",
    name: "Pablo Ocampo St",
    path: "M118 160 C236 156 342 160 534 170",
    labelX: 202,
    labelY: 148,
    tone: "primary"
  },
  {
    id: "chino-roces",
    name: "Chino Roces Ave",
    path: "M486 34 C470 82 454 126 440 176 C428 218 420 248 414 270",
    labelX: 472,
    labelY: 206,
    tone: "primary"
  },
  {
    id: "gil-puyat",
    name: "Sen. Gil Puyat Ave",
    path: "M84 286 C188 286 302 284 548 278",
    labelX: 182,
    labelY: 274,
    tone: "primary"
  }
];

export const makatiMapLabels: MapLabel[] = [
  { id: "olympia", name: "Olympia", x: 584, y: 116, kind: "district" },
  { id: "palanan", name: "Palanan", x: 244, y: 316, kind: "district" }
];

export const jeepneyTrafficSegments: TrafficSegment[] = [
  {
    id: "prc-ap-reyes",
    fromStopId: "prc-terminal",
    toStopId: "ap-reyes",
    path: "M492 56 C478 76 466 92 454 110",
    label: "terminal release",
    labelX: 486,
    labelY: 96
  },
  {
    id: "ap-reyes-p-ocampo",
    fromStopId: "ap-reyes",
    toStopId: "pablo-ocampo",
    path: "M454 110 C442 136 434 154 428 168",
    label: "P. Ocampo merge",
    labelX: 446,
    labelY: 144
  },
  {
    id: "p-ocampo-yakal",
    fromStopId: "pablo-ocampo",
    toStopId: "yakal",
    path: "M428 168 C418 190 412 206 410 226",
    label: "Chino Roces flow",
    labelX: 388,
    labelY: 202
  },
  {
    id: "yakal-buendia",
    fromStopId: "yakal",
    toStopId: "gil-puyat",
    path: "M410 226 C408 240 410 252 420 258 C396 268 360 276 288 286",
    label: "Buendia approach",
    labelX: 344,
    labelY: 278
  }
];
