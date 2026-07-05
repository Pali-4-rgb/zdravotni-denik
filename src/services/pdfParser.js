import { createPerson } from "../models/personFactory";

const SKAUTIS_CARD_START = "Zdravotní karta účastníka tábora";
const CVRCEK_CARD_START = "Přihláška na letní tábor T. K. Cvrček";

const pdfParser = {
  parseSkautisHealthCardText(text) {
    const people = this.parseSkautisHealthCardsText(text);
    return people[0] || null;
  },

  parseSkautisHealthCardsText(text) {
    if (!text || typeof text !== "string") return [];

    const normalizedText = normalizeText(text);

    if (normalizedText.includes(CVRCEK_CARD_START)) {
      return parseCvrcekApplication(normalizedText);
    }

    return parseSkautisCards(normalizedText);
  },
};

function parseSkautisCards(text) {
  const cardTexts = splitByMarker(text, SKAUTIS_CARD_START)
    .filter((part) => part.includes("Datum narození:"));

  return cardTexts
    .map((cardText, index) => parseSingleSkautisCard(cardText, index))
    .filter(Boolean);
}

function parseSingleSkautisCard(text, index) {
  const participantName = extractSkautisParticipantName(text);
  const nameParts = splitName(participantName);

  if (!participantName) return null;

  return createPerson({
    id: `${Date.now()}-${index}`,
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    birthDate: extractValue(text, "Datum narození:", "Kategorie:"),
    allergies: splitMedicalValue(extractValue(text, "Alergie:", "Užívané léky:")),
    medication: splitMedicalValue(
      extractValue(text, "Užívané léky:", "Další zdravotní omezení:")
    ),
    limitations: splitMedicalValue(
      extractValue(text, "Další zdravotní omezení:", "Stravovací omezení:")
    ),
    emergencyContacts: parseSkautisParents(text),
    notes: extractValue(text, "Poznámky zdravotníka:", ""),
    source: "skautis_pdf_web",
  });
}

function parseCvrcekApplication(text) {
  const name = extractValue(text, "Jméno účastníka:", "Rodné číslo účastníka");
  const nameParts = splitName(name);

  if (!name) return [];

  const parentPhone = extractValue(text, "Tel. kontakt na rodiče:", "E-mail:");
  const specialInfo = extractValue(
    text,
    "Žádám o přihlédnutí k těmto zvláštnostem dítěte:",
    "Plavecká zdatnost:"
  );
  const swimming = extractValue(
    text,
    "Plavecká zdatnost:",
    "Zdravotní pojišťovna účastníka:"
  );

  return [
    createPerson({
      id: `${Date.now()}-cvrcek`,
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      allergies: extractPossibleAllergies(specialInfo),
      medication: extractPossibleMedication(specialInfo),
      limitations: specialInfo ? [specialInfo] : [],
      emergencyContacts: parentPhone
        ? [
            {
              role: "Rodič",
              name: "Rodič",
              phone: cleanPhone(parentPhone),
            },
          ]
        : [],
      notes: swimming ? `Plavecká zdatnost: ${swimming}` : "",
      source: "cvrcek_pdf_web",
    }),
  ];
}

function normalizeText(text) {
  return text
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitByMarker(text, marker) {
  const parts = text.split(marker);

  if (parts.length <= 1) return [text];

  return parts.map((part) => `${marker} ${part}`.trim());
}

function extractSkautisParticipantName(text) {
  const match = text.match(/\)\s+(.+?)\s+Datum narození:/);
  return match ? match[1].trim() : "";
}

function extractValue(text, startLabel, endLabel) {
  const startIndex = text.indexOf(startLabel);
  if (startIndex === -1) return "";

  const valueStart = startIndex + startLabel.length;
  let valueEnd = text.length;

  if (endLabel) {
    const endIndex = text.indexOf(endLabel, valueStart);
    if (endIndex !== -1) valueEnd = endIndex;
  }

  return cleanValue(text.slice(valueStart, valueEnd));
}

function cleanValue(value) {
  return value
    .replace(/\.{3,}/g, "")
    .replace(/…+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSkautisParents(text) {
  const section = extractValue(
    text,
    "Zákonní zástupci",
    "Zdravotní údaje a dovednosti"
  );

  if (!section) return [];

  const roles = [];
  if (section.includes("Otec")) roles.push("Otec");
  if (section.includes("Matka")) roles.push("Matka");

  const phones = section.match(/\b\d{9}\b/g) || [];

  return roles
    .map((role, index) => ({
      role,
      name: role,
      phone: phones[index] || "",
    }))
    .filter((contact) => contact.phone);
}

function splitMedicalValue(value) {
  if (!value) return [];

  const cleaned = value.trim();
  const lowered = cleaned.toLowerCase();

  if (
    lowered === "ne" ||
    lowered === "není" ||
    lowered === "nejsou" ||
    lowered === "nemá" ||
    lowered === "zadne" ||
    lowered === "žádné" ||
    lowered === "žádná"
  ) {
    return [];
  }

  return cleaned
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractPossibleAllergies(value) {
  if (!value) return [];

  const lowered = value.toLowerCase();

  if (!lowered.includes("alerg")) return [];

  return [value];
}

function extractPossibleMedication(value) {
  if (!value) return [];

  const lowered = value.toLowerCase();

  if (
    !lowered.includes("lék") &&
    !lowered.includes("léky") &&
    !lowered.includes("užív")
  ) {
    return [];
  }

  return [value];
}

function cleanPhone(value) {
  const match = value.match(/\d[\d\s]{7,}\d/);
  return match ? match[0].replace(/\s+/g, "") : value.trim();
}

function splitName(fullName) {
  const parts = fullName.trim().split(" ").filter(Boolean);

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "",
    };
  }

  return {
    firstName: parts.slice(1).join(" "),
    lastName: parts[0],
  };
}

export default pdfParser;