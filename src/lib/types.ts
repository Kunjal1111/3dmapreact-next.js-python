export type LocationCategory = "academic" | "food" | "hostel" | "sports" | "services" | "outdoors";

export type CampusLocation = {
  id: string;
  name: string;
  description: string;
  category: LocationCategory;
  longitude: number | null;
  latitude: number | null;
  entranceLongitude?: number | null;
  entranceLatitude?: number | null;
  sourceUrl: string;
  isVerified: boolean;
  coordinatesVerified: boolean;
  routeNodeId: string | null;
};

export type WalkingRoute = {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
  instructions: string[];
};

export type AuthUser = { id: string; name: string; email: string; role: "USER" | "ADMIN" };

export const CATEGORIES: { id: LocationCategory; label: string }[] = [
  { id: "academic", label: "Academic" },
  { id: "food", label: "Food" },
  { id: "hostel", label: "Hostels" },
  { id: "sports", label: "Sports" },
  { id: "services", label: "Services" },
  { id: "outdoors", label: "Outdoors" },
];

export const CAMPUS_ADDRESS =
  "NH48, GETCO, Near Biltech, Dhamdod Village, Mangrol, Kosamba, Surat 394125, Gujarat, India";