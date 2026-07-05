const personTemplate = {
  id: "",
  firstName: "",
  lastName: "",
  displayName: "",
  birthDate: "",
  personalId: "",
  insuranceCompany: "",
  insuranceNumber: "",
  allergies: [],
  medication: [],
  diagnoses: [],
  limitations: [],
  vaccination: [],
  emergencyContacts: [],
  doctor: {
    name: "",
    phone: "",
    email: "",
  },
  notes: "",
  source: "manual",
  createdAt: "",
  updatedAt: "",
};

export function createPerson(overrides = {}) {
  const now = new Date().toISOString();
  const legacyName = splitLegacyName(overrides.name);

  const person = {
    ...personTemplate,
    ...overrides,

    firstName: overrides.firstName || legacyName.firstName || "",
    lastName: overrides.lastName || legacyName.lastName || "",
    notes: overrides.notes || overrides.note || "",

    doctor: {
      ...personTemplate.doctor,
      ...(overrides.doctor || {}),
    },

    allergies: safeArray(overrides.allergies),
    medication: safeArray(overrides.medication),
    diagnoses: safeArray(overrides.diagnoses),
    limitations: safeArray(overrides.limitations),
    vaccination: safeArray(overrides.vaccination),
    emergencyContacts: safeArray(overrides.emergencyContacts),

    id: overrides.id || Date.now().toString(),
    source: overrides.source || "manual",
    createdAt: overrides.createdAt || now,
    updatedAt: now,
  };

  person.displayName = buildDisplayName(person);

  return person;
}

export function updatePerson(existingPerson, updates = {}) {
  const updated = {
    ...existingPerson,
    ...updates,

    notes: updates.notes ?? updates.note ?? existingPerson.notes ?? "",

    doctor: {
      ...(existingPerson.doctor || personTemplate.doctor),
      ...(updates.doctor || {}),
    },

    allergies: safeArray(updates.allergies ?? existingPerson.allergies),
    medication: safeArray(updates.medication ?? existingPerson.medication),
    diagnoses: safeArray(updates.diagnoses ?? existingPerson.diagnoses),
    limitations: safeArray(updates.limitations ?? existingPerson.limitations),
    vaccination: safeArray(updates.vaccination ?? existingPerson.vaccination),
    emergencyContacts: safeArray(
      updates.emergencyContacts ?? existingPerson.emergencyContacts
    ),

    updatedAt: new Date().toISOString(),
  };

  updated.displayName = buildDisplayName(updated);

  return updated;
}

export function normalizePerson(rawPerson = {}) {
  return createPerson({
    ...rawPerson,
    id: rawPerson.id || Date.now().toString(),
    source: rawPerson.source || "manual",
    createdAt: rawPerson.createdAt || new Date().toISOString(),
  });
}

function buildDisplayName(person) {
  const fullName = `${person.firstName || ""} ${person.lastName || ""}`.trim();

  if (fullName) {
    return fullName;
  }

  if (person.displayName) {
    return person.displayName;
  }

  if (person.name) {
    return person.name;
  }

  return "Neznámá osoba";
}

function splitLegacyName(name) {
  if (!name || typeof name !== "string") {
    return {
      firstName: "",
      lastName: "",
    };
  }

  const parts = name.trim().split(" ").filter(Boolean);

  if (parts.length === 0) {
    return {
      firstName: "",
      lastName: "",
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "",
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function safeArray(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}