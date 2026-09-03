import { NextRequest, NextResponse } from "next/server";
import { distanceMeters } from "@/lib/geo";
import { createCheckIn, findEmployeeByTelegramId, getBranch, getTodayCheckIn } from "@/lib/notion";
import { validateTelegramInitData } from "@/lib/telegram";
import { grantTimelyArrival } from "@/lib/gamification";

export async function POST(request: NextRequest) {
  try {
    const { initData, latitude, longitude, accuracy } = (await request.json()) as {
      initData?: string; latitude?: number; longitude?: number; accuracy?: number;
    };
    if (!initData || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "Telegram authorization and GPS coordinates are required." }, { status: 400 });
    }
    const checkInLatitude = latitude as number;
    const checkInLongitude = longitude as number;
    if (accuracy && accuracy > 150) {
      return NextResponse.json({ error: "GPS accuracy is too low. Move closer to a window and try again." }, { status: 400 });
    }

    const telegramUser = validateTelegramInitData(initData);
    const employee = await findEmployeeByTelegramId(telegramUser.id);
    if (!employee) return NextResponse.json({ error: "Your Telegram ID is not linked to an employee." }, { status: 403 });
    if (!employee.primaryBranch) return NextResponse.json({ error: "Your employee profile has no primary branch." }, { status: 409 });

    const existing = await getTodayCheckIn(employee.id);
    if (existing) return NextResponse.json({ alreadyCheckedIn: true, record: existing });

    const branch = await getBranch(employee.primaryBranch);
    const distance = distanceMeters({ latitude: checkInLatitude, longitude: checkInLongitude }, branch);
    if (distance > branch.radiusMeters) {
      return NextResponse.json(
        {
          error: `Отметка возможна только на территории филиала. Вы на ${Math.round(distance)} м от точки, допустимый радиус — ${branch.radiusMeters} м.`,
        },
        { status: 403 },
      );
    }
    const record = await createCheckIn({
      employee,
      branch,
      latitude: checkInLatitude,
      longitude: checkInLongitude,
      distanceMeters: distance,
      insideRadius: true,
    });
    await grantTimelyArrival(employee);
    return NextResponse.json({ alreadyCheckedIn: false, branch: branch.name, record });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Check-in failed." }, { status: 400 });
  }
}
