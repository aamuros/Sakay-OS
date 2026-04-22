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
  "M458 54 C440 66 424 76 410 88 S374 118 348 136 S330 190 318 210 S296 264 286 288";

export const jeepneyRouteLayout: RouteStopLayout[] = [
  { stopId: "prc-terminal", x: 458, y: 54, labelDx: 0, labelDy: -28 },
  { stopId: "ap-reyes", x: 410, y: 88, labelDx: 62, labelDy: -4 },
  { stopId: "pablo-ocampo", x: 348, y: 136, labelDx: -76, labelDy: -18 },
  { stopId: "yakal", x: 318, y: 210, labelDx: 64, labelDy: -2 },
  { stopId: "gil-puyat", x: 286, y: 288, labelDx: 66, labelDy: 10 }
];

export const makatiRoads: MakatiRoad[] = [
  {
    id: "jp-rizal",
    name: "J.P. Rizal St",
    path: "M178 38 C272 28 394 30 562 46",
    labelX: 438,
    labelY: 26,
    tone: "primary"
  },
  {
    id: "ap-reyes",
    name: "A.P. Reyes Ave",
    path: "M520 30 C480 46 438 62 390 92",
    labelX: 482,
    labelY: 74,
    tone: "primary"
  },
  {
    id: "pablo-ocampo",
    name: "Pablo Ocampo St",
    path: "M74 132 C188 128 306 130 544 146",
    labelX: 170,
    labelY: 120,
    tone: "primary"
  },
  {
    id: "chino-roces",
    name: "Chino Roces Ave",
    path: "M382 18 C370 70 358 128 342 202 S308 300 292 344",
    labelX: 366,
    labelY: 232,
    tone: "primary"
  },
  {
    id: "kamagong",
    name: "Kamagong St",
    path: "M166 182 C258 176 354 176 506 184",
    labelX: 520,
    labelY: 174,
    tone: "secondary"
  },
  {
    id: "yakal",
    name: "Yakal St",
    path: "M176 214 C268 206 364 206 530 214",
    labelX: 542,
    labelY: 204,
    tone: "secondary"
  },
  {
    id: "metropolitan",
    name: "Metropolitan Ave",
    path: "M146 246 C244 236 372 238 594 248",
    labelX: 560,
    labelY: 236,
    tone: "secondary"
  },
  {
    id: "gil-puyat",
    name: "Sen. Gil Puyat Ave",
    path: "M52 284 C176 284 312 286 640 302",
    labelX: 154,
    labelY: 272,
    tone: "primary"
  },
  {
    id: "don-bosco",
    name: "Don Bosco St",
    path: "M446 122 C448 170 452 228 460 334",
    labelX: 470,
    labelY: 314,
    tone: "local"
  },
  {
    id: "pasong-tamo-ext",
    name: "South Ave",
    path: "M514 82 C578 92 630 102 688 118",
    labelX: 628,
    labelY: 102,
    tone: "local"
  },
  {
    id: "dela-rosa",
    name: "Dela Rosa Access",
    path: "M548 156 C556 206 562 252 566 326",
    labelX: 584,
    labelY: 312,
    tone: "secondary"
  }
];

export const makatiMapLabels: MapLabel[] = [
  { id: "tejeros", name: "Tejeros", x: 548, y: 78, kind: "district" },
  { id: "santa-cruz", name: "Santa Cruz", x: 222, y: 106, kind: "district" },
  { id: "san-antonio", name: "San Antonio", x: 250, y: 248, kind: "district" },
  { id: "circuit", name: "Circuit Makati", x: 576, y: 52, kind: "landmark" },
  { id: "shopwise", name: "Shopwise", x: 264, y: 150, kind: "landmark" },
  { id: "mapua", name: "Mapua Makati", x: 460, y: 122, kind: "landmark" },
  { id: "mcs", name: "Makati Central Square", x: 470, y: 238, kind: "landmark" }
];

export const jeepneyTrafficSegments: TrafficSegment[] = [
  {
    id: "prc-ap-reyes",
    fromStopId: "prc-terminal",
    toStopId: "ap-reyes",
    path: "M458 54 C440 66 424 76 410 88",
    label: "terminal release",
    labelX: 472,
    labelY: 92
  },
  {
    id: "ap-reyes-p-ocampo",
    fromStopId: "ap-reyes",
    toStopId: "pablo-ocampo",
    path: "M410 88 C384 106 368 120 348 136",
    label: "P. Ocampo merge",
    labelX: 362,
    labelY: 102
  },
  {
    id: "p-ocampo-yakal",
    fromStopId: "pablo-ocampo",
    toStopId: "yakal",
    path: "M348 136 C334 156 326 182 318 210",
    label: "Chino Roces flow",
    labelX: 276,
    labelY: 172
  },
  {
    id: "yakal-buendia",
    fromStopId: "yakal",
    toStopId: "gil-puyat",
    path: "M318 210 C302 236 292 264 286 288",
    label: "Buendia approach",
    labelX: 222,
    labelY: 250
  }
];
