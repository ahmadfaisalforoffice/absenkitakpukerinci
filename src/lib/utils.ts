import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const OFFICE_LOCATION = {
  lat: -2.0853438626754386,
  lng: 101.46273251076296,
  radius: 150, // 150 meters
};

export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function getWorkSchedule(date: Date) {
  const day = date.getDay();
  const isFriday = day === 5;
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) return null;

  return {
    start: "07:30",
    end: isFriday ? "16:30" : "16:00",
    lateLimit: "08:30",
  };
}

