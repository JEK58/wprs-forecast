import { getCivlId } from "@/utils/get-civl-id";
import { load } from "cheerio";

interface PWCApiResponse {
  subscriptions?: PilotDetails[];
  isSelectionStarted: boolean;
  subscriptionStatusesOrder?: string[];
}

type SubscriptionStatusKeys =
  | "confirmed"
  | "wildcard_confirmed"
  | "guest_card_confirmed"
  | "payment_in_progress"
  | "waiting_for_payment"
  | "wildcard"
  | "guest_card"
  | "waiting_list"
  | "cancelled"
  | "late_cancelled";

export interface PilotDetails {
  season_number?: number | string;
  pilot?: string;
  country?: string;
  country_flag?: string;
  glider?: string;
  harness?: string;
  sponsor?: string;
  status?: string;
  status_key?: SubscriptionStatusKeys;
  is_late?: boolean;
  qualification_letters?: string;
}

// https://pwca.org/storage/3539/PWCA-Competition-Rules-2023.pdf
const MAX_PILOTS = 125;

export async function getPwcComp(url: string) {
  const response = await fetch(url);
  const body = await response.text();

  const $ = load(body, { xmlMode: true });
  const compTitle = $('h2[class="title"]').text();

  const apiUrl = url.replace("pwca.org", "pwca.org/api");
  const femaleApiUrl = apiUrl + "?gender=female";

  const [maleRes, femaleRes] = await Promise.all([
    await fetch(apiUrl),
    await fetch(femaleApiUrl),
  ]);

  if (maleRes.status == 404 || femaleRes.status == 404) return;

  const male = (await maleRes.json()) as PWCApiResponse;
  const female = (await femaleRes.json()) as PWCApiResponse;

  const mergedData = [
    ...(male.subscriptions ?? []),
    ...(female.subscriptions ?? []),
  ];

  if (!mergedData.length) return;

  const pilots = await Promise.all(
    mergedData.map(async (el) => {
      const input = el.pilot ?? "";
      const name = input.split(" (")[0] ?? "";
      const civlID = await getCivlId(name);

      return {
        name,
        nationality: el.country,
        civlID,
        wing: el.glider,
        status: el.status,
        confirmed: isConfirmed(el.status_key),
      };
    })
  );

  return {
    compTitle,
    maxPilots: MAX_PILOTS,
    pilots,
  };
}

function isConfirmed(status?: string) {
  return (
    status?.toLowerCase() == "confirmed" ||
    status?.toLowerCase() == "wildcard" ||
    status?.toLowerCase() == "guest_card_confirmed"
  );
}
