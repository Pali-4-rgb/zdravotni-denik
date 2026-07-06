import { useEffect, useMemo, useState } from "react";
import { extractTextFromPdf } from "./services/pdfExtractor";
import pdfParser from "./services/pdfParser";
import "./App.css";

const STORAGE_KEY = "zdravotni-denik-web-people-v1";

export default function App() {
  const [people, setPeople] = useState([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
  const [activeTab, setActiveTab] = useState("cards");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setPeople(JSON.parse(saved));
    setStorageLoaded(true);
  }, []);

  useEffect(() => {
    if (!storageLoaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
  }, [people, storageLoaded]);

  const filteredPeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return people;

    return people.filter((person) =>
      [
        person.displayName,
        person.firstName,
        person.lastName,
        person.birthDate,
        ...(person.allergies || []),
        ...(person.medication || []),
        ...(person.limitations || []),
        person.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [people, search]);

  const handleCreatePerson = (person) => {
    const displayName =
      `${person.firstName || ""} ${person.lastName || ""}`.trim() ||
      "Neznámá osoba";

    const newPerson = {
      ...person,
      id: Date.now().toString(),
      displayName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: "manual",
    };

    setPeople((current) => [...current, newPerson]);
    setEditingPerson(null);
  };

  const handleUpdatePerson = (updatedPerson) => {
    const displayName =
      `${updatedPerson.firstName || ""} ${updatedPerson.lastName || ""}`.trim() ||
      updatedPerson.displayName ||
      "Neznámá osoba";

    const finalPerson = {
      ...updatedPerson,
      displayName,
      updatedAt: new Date().toISOString(),
    };

    setPeople((current) =>
      current.map((person) =>
        person.id === finalPerson.id ? finalPerson : person
      )
    );

    setSelectedPerson(finalPerson);
    setEditingPerson(null);
  };

  const handleSavePerson = (person) => {
    if (person.id) {
      handleUpdatePerson(person);
    } else {
      handleCreatePerson(person);
    }
  };

  const handleDelete = (id) => {
    if (!window.confirm("Opravdu chceš smazat tuto kartu?")) return;

    setPeople((current) => current.filter((person) => person.id !== id));
    setSelectedPerson(null);
  };

  return (
    <div className="app">
      <header className="appHeader">
        <h1>Zdravotní deník</h1>
        <p>Webová verze</p>
      </header>

      <main className="appMain">
        {activeTab === "cards" && (
          <>
            <div className="searchBox">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Hledat osobu, alergii, lék..."
              />
            </div>

            <div className="stats">
              <span>Celkem: {people.length}</span>
              <span>Alergie: {people.filter((p) => p.allergies?.length).length}</span>
              <span>Léky: {people.filter((p) => p.medication?.length).length}</span>
            </div>

            <div className="cardList">
              {filteredPeople.length === 0 && (
                <p className="empty">Zatím žádné karty</p>
              )}

              {filteredPeople.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  onClick={() => setSelectedPerson(person)}
                />
              ))}
            </div>

            <button className="fab" onClick={() => setEditingPerson({})}>
              +
            </button>
          </>
        )}

        {activeTab === "import" && (
          <ImportPage
            onImport={(importedPeople) => {
              setPeople((current) => [...current, ...importedPeople]);
              setActiveTab("cards");
            }}
          />
        )}
      </main>

      <nav className="bottomNav">
        <button
          className={activeTab === "cards" ? "active" : ""}
          onClick={() => setActiveTab("cards")}
        >
          🏠 Karty
        </button>

        <button
          className={activeTab === "import" ? "active" : ""}
          onClick={() => setActiveTab("import")}
        >
          📄 Import PDF
        </button>
      </nav>

      {selectedPerson && (
        <PersonDetail
          person={selectedPerson}
          onClose={() => setSelectedPerson(null)}
          onEdit={() => setEditingPerson(selectedPerson)}
          onDelete={() => handleDelete(selectedPerson.id)}
        />
      )}

      {editingPerson && (
        <PersonEditor
          person={editingPerson}
          onClose={() => setEditingPerson(null)}
          onSave={handleSavePerson}
        />
      )}
    </div>
  );
}

function PersonCard({ person, onClick }) {
  const allergiesCount = person.allergies?.length || 0;
  const medicationCount = person.medication?.length || 0;
  const contactsCount = person.emergencyContacts?.length || 0;

  const riskLevel =
    allergiesCount && medicationCount
      ? "high"
      : allergiesCount || medicationCount
        ? "medium"
        : "low";

  return (
    <button className={`personCard ${riskLevel}`} onClick={onClick}>
      <div>
        <strong>👤 {person.displayName}</strong>
        {person.birthDate && <small>🎂 {getAge(person.birthDate)}</small>}
      </div>

      <div className="badges">
        <span>⚠️ {allergiesCount}</span>
        <span>💊 {medicationCount}</span>
        <span>📞 {contactsCount}</span>
      </div>
    </button>
  );
}

function PersonDetail({ person, onClose, onEdit, onDelete }) {
  return (
    <div className="modalOverlay">
      <div className="detailModal">
        <button className="closeButton" onClick={onClose}>×</button>

        <h2>👤 {person.displayName}</h2>

        {person.birthDate && (
          <p className="muted">
            Datum narození: {person.birthDate} ({getAge(person.birthDate)})
          </p>
        )}

        <DetailSection title="⚠️ Alergie" items={person.allergies} important />
        <DetailSection title="💊 Léky" items={person.medication} />
        <DetailSection title="🚫 Omezení" items={person.limitations} />

       {person.emergencyContacts?.length > 0 && (
  <section className="detailSection">
    <h3>📞 Kontakty</h3>

    {person.emergencyContacts.map((contact, index) => {
      const phone = contact.phone || "";
      const cleanPhone = phone.replace(/\s+/g, "");

      return (
        <p key={index}>
          {(contact.role || contact.name) && (
            <>
              <strong>{contact.role || "Kontakt"}:</strong>{" "}
              {contact.name || ""}
              {phone ? " – " : ""}
            </>
          )}

          {phone && (
            <a href={`tel:${cleanPhone}`} className="phoneLink">
              {phone}
            </a>
          )}
        </p>
      );
    })}
  </section>
)}

        {person.notes && (
          <section className="detailSection note">
            <h3>📝 Poznámky</h3>
            <p>{person.notes}</p>
          </section>
        )}

        <div className="detailActions">
          <button className="editButton" onClick={onEdit}>
            ✏️ Upravit kartu
          </button>

          <button className="deleteButton" onClick={onDelete}>
            🗑️ Smazat kartu
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonEditor({ person, onClose, onSave }) {
  const [firstName, setFirstName] = useState(person.firstName || "");
  const [lastName, setLastName] = useState(person.lastName || "");
  const [birthDate, setBirthDate] = useState(person.birthDate || "");
  const [allergies, setAllergies] = useState(arrayToText(person.allergies));
  const [medication, setMedication] = useState(arrayToText(person.medication));
  const [limitations, setLimitations] = useState(arrayToText(person.limitations));
  const [emergencyContacts, setemergencyContacts] = useState(arrayToText(person.emergencyContacts));
  const [notes, setNotes] = useState(person.notes || "");

  const handleSave = () => {
    onSave({
      ...person,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      birthDate: birthDate.trim(),
      allergies: textToArray(allergies),
      medication: textToArray(medication),
      limitations: textToArray(limitations),
      emergencyContacts: contactsTextToArray(emergencyContacts),
      notes: notes.trim(),
    });
  };

  return (
    <div className="modalOverlay">
      <div className="detailModal">
        <button className="closeButton" onClick={onClose}>×</button>

        <h2>{person.id ? "✏️ Upravit kartu" : "➕ Přidat kartu"}</h2>

        <label>Jméno</label>
        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />

        <label>Příjmení</label>
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} />

        <label>Datum narození</label>
        <input value={birthDate} onChange={(e) => setBirthDate(e.target.value)} placeholder="DD.MM.RRRR" />

        <label>Alergie</label>
        <textarea value={allergies} onChange={(e) => setAllergies(e.target.value)} />

        <label>Léky</label>
        <textarea value={medication} onChange={(e) => setMedication(e.target.value)} />

        <label>Omezení</label>
        <textarea value={limitations} onChange={(e) => setLimitations(e.target.value)} />

        <label>Kontakty na rodiče</label>
        <textarea value={emergencyContacts} onChange={(e) => setemergencyContacts(e.target.value)} />

        <label>Poznámky</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          

        <button className="saveButton" onClick={handleSave}>
          Uložit
        </button>
      </div>
    </div>
  );
}

function DetailSection({ title, items, important }) {
  if (!items || items.length === 0) return null;

  return (
    <section className={`detailSection ${important ? "important" : ""}`}>
      <h3>{title}</h3>
      {items.map((item, index) => (
        <p key={index}>• {item}</p>
      ))}
    </section>
  );
}

function ImportPage({ onImport }) {
  const handlePdf = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await extractTextFromPdf(file);
      const importedPeople = pdfParser.parseSkautisHealthCardsText(text);

      if (importedPeople.length === 0) {
        alert("Z PDF se nepodařilo vytvořit žádnou kartu.");
        return;
      }

      onImport(importedPeople);
      alert(`Importováno karet: ${importedPeople.length}`);
    } catch (error) {
      console.error(error);
      alert(String(error));
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="importPage">
      <h2>📄 Import PDF ze SkautIS</h2>
      <p>Vyber vícestránkové PDF. Import probíhá lokálně v prohlížeči.</p>

      <input
        className="fileInput"
        type="file"
        accept="application/pdf"
        onChange={handlePdf}
      />
    </div>
  );
}

function getAge(birthDate) {
  if (!birthDate) return "";

  const parts = birthDate.split(".");
  if (parts.length !== 3) return "";

  const day = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const year = Number(parts[2]);

  const today = new Date();
  const birthday = new Date(year, month, day);

  let age = today.getFullYear() - birthday.getFullYear();

  const hadBirthday =
    today.getMonth() > birthday.getMonth() ||
    (today.getMonth() === birthday.getMonth() &&
      today.getDate() >= birthday.getDate());

  if (!hadBirthday) age -= 1;

  return age > 0 ? `${age} let` : "";
}

function arrayToText(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function textToArray(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}
function contactsTextToArray(value) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => ({
      role: "Rodič",
      name: "",
      phone: item,
    }));
}