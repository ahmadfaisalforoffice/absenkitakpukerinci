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

export function parseDate(dateStr: string | Date | null | undefined): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  
  // If it's already an ISO string (contains T and Z or offset), parse it directly
  if (dateStr.includes('T')) return new Date(dateStr);
  
  // If it's a string from PG TIMESTAMP (without timezone), it might have a space
  // Replace space with T to make it ISO-compliant for browser parsing as local time
  return new Date(dateStr.replace(' ', 'T'));
}

export function getJakartaDate(): Date {
  // Create a date object for the current time in Jakarta
  const now = new Date();
  const jakartaTime = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
  return new Date(jakartaTime);
}
