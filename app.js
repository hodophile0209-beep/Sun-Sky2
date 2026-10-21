
"use strict";

// ==========================================
// SUN & SKY — SCRAPBOOK MEMORY BOOK ☀️
// ==========================================

const grid = document.getElementById("calendarGrid");
const monthTitle = document.getElementById("monthTitle");
const monthSubtitle = document.getElementById("monthSubtitle");

const dialog = document.getElementById("memoryDialog");
const dateTitle = document.getElementById("selectedDateTitle");
const dateSubtitle = document.getElementById("selectedDateSubtitle");

const photoGrid = document.getElementById("photoGrid");
const photoInput = document.getElementById("photoInput");
const saveStatus = document.getElementById("saveStatus");

const memoryForm = document.getElementById("memoryForm");
const captionInput = document.getElementById("memoryCaption");

const memoryList = document.getElementById("memoryList");
const memoryCount = document.getElementById("memoryCount");

const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const profileBtn = document.getElementById("profileBtn");

let currentMonth = new Date();
currentMonth.setDate(1);

let selectedDate = null;
let memories = [];
let db = null;
let storageReady = false;
let isSaving = false;

// ==========================================
// STATUS
// ==========================================

function showStatus(message) {
  saveStatus.textContent = message;
}

// ==========================================
// DATE HELPERS
// ==========================================

function dateKey(year, month, day) {
  return [
    year,
    String(month + 1).padStart(2, "0"),
    String(day).padStart(2, "0")
  ].join("-");
}

function isValidDateKey(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;

  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function prettyDate(key) {
  const [year, month, day] = key.split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString(
    "en-IN",
    { day: "numeric", month: "long", year: "numeric" }
  );
}

// ==========================================
// DATABASE — KEEP EXISTING MEMORIES
// ==========================================

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }

    let request;

    try {
      request = indexedDB.open("SunAndSkyDB", 1);
    } catch (error) {
      reject(error);
      return;
    }

    request.onupgradeneeded = event => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains("memories")) {
        database.createObjectStore("memories", {
          keyPath: "date"
        });
      }
    };

    request.onsuccess = event => {
      db = event.target.result;

      db.onversionchange = () => {
        db.close();
        db = null;
        storageReady = false;
        showStatus("Please refresh Sun & Sky to reconnect storage.");
      };

      resolve(db);
    };

    request.onerror = () => {
      reject(request.error || new Error("Database could not open."));
    };
  });
}

function loadMemories() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error("Database is not ready."));
      return;
    }

    const transaction = db.transaction("memories", "readonly");
    const request = transaction.objectStore("memories").getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => {
      reject(request.error || new Error("Memories could not load."));
    };
  });
}

function saveMemory(memory) {
  return new Promise((resolve, reject) => {
    if (!db || !storageReady) {
      reject(new Error("Storage is not ready. Refresh and retry."));
      return;
    }

    let transaction;

    try {
      transaction = db.transaction("memories", "readwrite");
      transaction.objectStore("memories").put(memory);
    } catch (error) {
      reject(error);
      return;
    }

    transaction.oncomplete = resolve;

    transaction.onerror = () => {
      reject(transaction.error || new Error("Save failed."));
    };

    transaction.onabort = () => {
      reject(
        transaction.error ||
        new Error("Storage is full or the save was interrupted.")
      );
    };
  });
}

// ==========================================
// CALENDAR
// ==========================================

function renderCalendar() {
  grid.replaceChildren();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  monthTitle.textContent = currentMonth.toLocaleDateString(
    "en-IN",
    { month: "long", year: "numeric" }
  );

  monthSubtitle.textContent = "A month full of possibilities ✨";

  const offset = (
    new Date(year, month, 1).getDay() + 6
  ) % 7;

  const totalDays = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const todayKey = dateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const datesWithMemories = new Set(
    memories.map(memory => memory.date)
  );

  for (let i = 0; i < offset; i++) {
    const blank = document.createElement("div");
    blank.className = "day empty";
    blank.setAttribute("aria-hidden", "true");
    grid.appendChild(blank);
  }

  for (let day = 1; day <= totalDays; day++) {
    const key = dateKey(year, month, day);
    const button = document.createElement("button");

    button.type = "button";
    button.className = "day";
    button.textContent = day;
    button.setAttribute("aria-label", prettyDate(key));

    if (key === todayKey) button.classList.add("today");
    if (key === selectedDate) button.classList.add("selected");

    if (datesWithMemories.has(key)) {
      button.classList.add("has-memory");
      button.setAttribute(
        "aria-label",
        prettyDate(key) + ", has memories"
      );
    }

    button.addEventListener("click", () => openDate(key));
    grid.appendChild(button);
  }
}

// ==========================================
// OPEN A SCRAPBOOK PAGE
// ==========================================

function openDate(key) {
  if (!isValidDateKey(key)) return;

  selectedDate = key;

  dateTitle.textContent = "Your memories ♡";
  dateSubtitle.textContent = prettyDate(key);

  showStatus("");

  const memory = memories.find(item => item.date === key);
  captionInput.value = memory ? memory.caption || "" : "";

  try {
    sessionStorage.setItem("sunsky-date", key);
  } catch (error) {
    // Optional.
  }

  renderPhotoGallery(memory);
  renderCalendar();

  if (!dialog.open) dialog.showModal();
}

function renderPhotoGallery(memory) {
  photoGrid.replaceChildren();

  const photos = memory && Array.isArray(memory.photos)
    ? memory.photos
    : [];

  if (!photos.length) {
    const message = document.createElement("p");
    message.className = "dialog-subtitle";
    message.textContent =
      "This page is waiting for its first memory. Add a photo to begin. ☀️";

    photoGrid.appendChild(message);
    return;
  }

  photos.forEach((photo, index) => {
    const frame = document.createElement("figure");
    frame.className = "scrapbook-photo";

    const image = document.createElement("img");
    image.src = photo.data;
    image.alt = "Memory " + (index + 1) + " from " + prettyDate(memory.date);
    image.loading = "lazy";

    const label = document.createElement("figcaption");
    label.textContent = "♡ " + prettyDate(memory.date);

    frame.append(image, label);
    photoGrid.appendChild(frame);
  });

  if (memory.caption) {
    const note = document.createElement("div");
    note.className = "scrapbook-note";
    note.textContent = memory.caption;
    photoGrid.appendChild(note);
  }
}

// ==========================================
// READ AND COMPRESS PHOTOS
// ==========================================

function readPhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Please select an image."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Could not read this photo."));

    reader.onload = () => {
      const image = new Image();

      image.onerror = () => reject(
        new Error("Unsupported photo format. Try JPEG or PNG.")
      );

      image.onload = () => {
        try {
          const maxSide = 1400;
          const scale = Math.min(
            1,
            maxSide / Math.max(image.width, image.height)
          );

          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));

          const context = canvas.getContext("2d");

          if (!context) throw new Error("Could not prepare the image.");

          context.drawImage(
            image, 0, 0, canvas.width, canvas.height
          );

          resolve({
            name: file.name,
            data: canvas.toDataURL("image/jpeg", 0.82)
          });
        } catch (error) {
          reject(error);
        }
      };

      image.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

// ==========================================
// ADD MORE PHOTOS TO THE SAME DATE
// ==========================================

async function addPhotos(files) {
  if (isSaving) {
    showStatus("Your memories are being saved. One moment! 💛");
    return;
  }

  if (!storageReady || !db) {
    showStatus("Storage isn't ready. Refresh and try again.");
    return;
  }

  if (!selectedDate) {
    showStatus("Please choose a date first. ☀️");
    return;
  }

  isSaving = true;
  photoInput.disabled = true;

  const dateBeingSaved = selectedDate;

  try {
    const existing = memories.find(
      memory => memory.date === dateBeingSaved
    );

    const oldPhotos = existing?.photos || [];
    const newPhotos = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      showStatus(
        "Preparing photo " + (i + 1) + " of " + files.length + "... 📸"
      );

      try {
        newPhotos.push(await readPhoto(files[i]));
      } catch (error) {
        errors.push(error.message || "A photo could not be processed.");
      }
    }

    if (!newPhotos.length) {
      throw new Error(errors.join(" ") || "No usable photos selected.");
    }

    const updatedMemory = {
      date: dateBeingSaved,
      caption: captionInput.value.trim() ||
        (existing ? existing.caption || "" : ""),
      photos: [...oldPhotos, ...newPhotos]
    };

    showStatus("Adding your memories to the scrapbook... ✨");

    await saveMemory(updatedMemory);

    const index = memories.findIndex(
      memory => memory.date === dateBeingSaved
    );

    if (index >= 0) {
      memories[index] = updatedMemory;
    } else {
      memories.push(updatedMemory);
    }

    renderCalendar();
    renderMemoryList();

    if (selectedDate === dateBeingSaved && dialog.open) {
      renderPhotoGallery(updatedMemory);
    }

    showStatus(
      newPhotos.length + " photo(s) added! ♡" +
      (errors.length ? " Some photos could not be used." : "")
    );
  } catch (error) {
    showStatus("Couldn't save: " + (error.message || "Please retry."));
  } finally {
    isSaving = false;
    photoInput.disabled = false;
    photoInput.value = "";
  }
}

photoInput.addEventListener("change", () => {
  const files = Array.from(photoInput.files || []);

  if (files.length) addPhotos(files);
});

// ==========================================
// SAVE OR UPDATE THE NOTE
// ==========================================

memoryForm.addEventListener("submit", async event => {
  event.preventDefault();

  if (isSaving) {
    showStatus("Please wait for the current save to finish.");
    return;
  }

  if (!storageReady || !db) {
    showStatus("Storage isn't ready. Refresh and try again.");
    return;
  }

  if (!selectedDate) {
    showStatus("Please choose a date first.");
    return;
  }

  const existing = memories.find(
    memory => memory.date === selectedDate
  );

  if (!existing || !existing.photos?.length) {
    showStatus("Add a photo first to save a note. ♡");
    return;
  }

  isSaving = true;

  const button = memoryForm.querySelector('button[type="submit"]');
  if (button) button.disabled = true;

  try {
    const updatedMemory = {
      ...existing,
      caption: captionInput.value.trim()
    };

    await saveMemory(updatedMemory);

    const index = memories.findIndex(
      memory => memory.date === selectedDate
    );

    if (index >= 0) memories[index] = updatedMemory;

    renderMemoryList();
    renderPhotoGallery(updatedMemory);

    showStatus("Your note has been saved! 💛");
  } catch (error) {
    showStatus("Couldn't save the note. Please try again.");
  } finally {
    isSaving = false;
    if (button) button.disabled = false;
  }
});

// ==========================================
// MONTH NAVIGATION
// ==========================================

prevMonthBtn.addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  renderCalendar();
});

// ==========================================
// MEMORY COLLECTION
// ==========================================

function renderMemoryList() {
  memoryList.replaceChildren();

  const totalPhotos = memories.reduce(
    (total, memory) => total + (memory.photos?.length || 0),
    0
  );

  memoryCount.textContent =
    totalPhotos + (totalPhotos === 1 ? " photo" : " photos");

  const sorted = [...memories].sort(
    (a, b) => b.date.localeCompare(a.date)
  );

  if (!sorted.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";

    const sun = document.createElement("div");
    sun.className = "sun";
    sun.textContent = "☀️";

    const heading = document.createElement("h3");
    heading.textContent = "Your story starts here";

    const paragraph = document.createElement("p");
    paragraph.textContent =
      "Choose a date and add your very first memory.";

    empty.append(sun, heading, paragraph);
    memoryList.appendChild(empty);
    return;
  }

  sorted.forEach(memory => {
    const card = document.createElement("article");
    card.className = "memory-card";
    card.tabIndex = 0;
    card.setAttribute(
      "aria-label",
      "Open memories from " + prettyDate(memory.date)
    );

    const photos = memory.photos || [];

    if (photos.length) {
      const image = document.createElement("img");
      image.src = photos[0].data;
      image.alt = "Memory from " + prettyDate(memory.date);
      image.loading = "lazy";
      card.appendChild(image);
    }

    const heading = document.createElement("h3");
    heading.textContent = prettyDate(memory.date);

    const description = document.createElement("p");
    description.textContent =
      (memory.caption ? memory.caption + " · " : "") +
      photos.length + (photos.length === 1 ? " photo" : " photos");

    card.append(heading, description);

    card.addEventListener("click", () => openDate(memory.date));

    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDate(memory.date);
      }
    });

    memoryList.appendChild(card);
  });
}

// ==========================================
// PROFILE
// ==========================================

profileBtn.addEventListener("click", () => {
  alert(
    "Welcome Back Home 🎀\n\n" +
    "Your Sun & Sky scrapbook is your little place for memories. ☀️"
  );
});

// ==========================================
// CLOSE SCRAPBOOK
// ==========================================

dialog.addEventListener("close", () => {
  try {
    sessionStorage.removeItem("sunsky-date");
  } catch (error) {
    // Optional.
  }

  renderCalendar();
});

// ==========================================
// START
// ==========================================

async function startApp() {
  renderCalendar();
  renderMemoryList();

  showStatus("Opening your memory book... ☀️");

  try {
    await openDatabase();
    memories = await loadMemories();
    storageReady = true;

    renderCalendar();
    renderMemoryList();
    showStatus("");

    try {
      const lastDate = sessionStorage.getItem("sunsky-date");

      if (lastDate && isValidDateKey(lastDate)) {
        openDate(lastDate);
      }
    } catch (error) {
      // Optional.
    }
  } catch (error) {
    storageReady = false;
    showStatus(
      "Couldn't open memory storage. Refresh the page and try again."
    );
  }
}

startApp();
