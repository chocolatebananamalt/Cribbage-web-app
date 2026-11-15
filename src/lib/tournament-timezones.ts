export type TournamentStateTerritory =
  | "Alabama" | "Alaska" | "Arizona" | "Arkansas" | "California" | "Colorado" | "Connecticut" | "Delaware"
  | "Florida" | "Georgia" | "Hawaii" | "Idaho" | "Illinois" | "Indiana" | "Iowa" | "Kansas" | "Kentucky"
  | "Louisiana" | "Maine" | "Maryland" | "Massachusetts" | "Michigan" | "Minnesota" | "Mississippi" | "Missouri"
  | "Montana" | "Nebraska" | "Nevada" | "New Hampshire" | "New Jersey" | "New Mexico" | "New York" | "North Carolina"
  | "North Dakota" | "Ohio" | "Oklahoma" | "Oregon" | "Pennsylvania" | "Rhode Island" | "South Carolina" | "South Dakota"
  | "Tennessee" | "Texas" | "Utah" | "Vermont" | "Virginia" | "Washington" | "West Virginia" | "Wisconsin" | "Wyoming"
  | "District of Columbia" | "Puerto Rico" | "U.S. Virgin Islands" | "American Samoa" | "Guam" | "Northern Mariana Islands";

export const tournamentStateTerritories: TournamentStateTerritory[] = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "District of Columbia", "Puerto Rico", "U.S. Virgin Islands", "American Samoa", "Guam", "Northern Mariana Islands",
];

export function isTournamentStateTerritory(value: unknown): value is TournamentStateTerritory {
  return typeof value === "string" && tournamentStateTerritories.includes(value as TournamentStateTerritory);
}

export const tournamentTimeZones = [
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaiian — Hawaii Standard Time" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Phoenix", label: "Arizona — Mountain Standard Time (no daylight saving)" },
  { value: "America/Puerto_Rico", label: "Puerto Rico / U.S. Virgin Islands — Atlantic Standard Time" },
  { value: "Pacific/Pago_Pago", label: "American Samoa — Samoa Standard Time" },
  { value: "Pacific/Guam", label: "Guam / Northern Mariana Islands — Chamorro Standard Time" },
] as const;

const stateDefaults: Partial<Record<TournamentStateTerritory, (typeof tournamentTimeZones)[number]["value"]>> = Object.fromEntries([
  ["Alaska", "America/Anchorage"],
  ...["California", "Nevada", "Oregon", "Washington"].map((state) => [state, "America/Los_Angeles"]),
  ["Arizona", "America/Phoenix"], ["Hawaii", "Pacific/Honolulu"],
  ...["Idaho", "Montana", "Wyoming", "Colorado", "Utah", "New Mexico"].map((state) => [state, "America/Denver"]),
  ...["North Dakota", "South Dakota", "Nebraska", "Kansas", "Oklahoma", "Texas", "Minnesota", "Iowa", "Missouri", "Arkansas", "Louisiana", "Wisconsin", "Illinois", "Mississippi", "Alabama", "Tennessee"].map((state) => [state, "America/Chicago"]),
  ...["Kentucky", "Michigan", "Indiana", "Ohio", "West Virginia", "Virginia", "North Carolina", "South Carolina", "Georgia", "Florida", "District of Columbia", "Maryland", "Delaware", "Pennsylvania", "New Jersey", "New York", "Connecticut", "Rhode Island", "Massachusetts", "Vermont", "New Hampshire", "Maine"].map((state) => [state, "America/New_York"]),
  ...["Puerto Rico", "U.S. Virgin Islands"].map((state) => [state, "America/Puerto_Rico"]),
  ["American Samoa", "Pacific/Pago_Pago"], ...["Guam", "Northern Mariana Islands"].map((state) => [state, "Pacific/Guam"]),
]) as Partial<Record<TournamentStateTerritory, (typeof tournamentTimeZones)[number]["value"]>>;

export function defaultTimeZoneForStateTerritory(stateTerritory: string) {
  return stateDefaults[stateTerritory as TournamentStateTerritory] ?? "America/New_York";
}
