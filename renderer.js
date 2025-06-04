const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { ipcRenderer } = require('electron');

window.onload = () => {
  const buttonGrid = document.getElementById("button-grid");
  const popup = document.getElementById("popup");
  const form = document.getElementById("edit-form");
  const menuBtn = document.getElementById("menu-btn");
  const nextBtn = document.getElementById("next-btn");
  const prevBtn = document.getElementById("prev-btn");
  const deleteBtn = document.getElementById("delete-btn");

  let buttons = [];
  let currentPage = 0;
  const buttonsPerPage = 6;
  let editIndex = null;
  let voiceAccessActive = false;

  const userDataPath = ipcRenderer.sendSync('get-user-data-path');
  const configDir = path.join(userDataPath, 'stream-deck-enhanced');
  const configPath = path.join(configDir, 'buttons.json');
  const colorConfigPath = path.join(configDir, 'background.json');

  const cycleColors = ['#001f1f', '#222222', '#2d0033', '#331100', '#000000', '#003300', '#330000'];
  let currentColorIndex = 0;

  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

  if (fs.existsSync(colorConfigPath)) {
    try {
      const saved = JSON.parse(fs.readFileSync(colorConfigPath, "utf8"));
      if (saved.hex) {
        document.body.style.backgroundColor = saved.hex;
        const index = cycleColors.indexOf(saved.hex);
        if (index !== -1) currentColorIndex = index;
      }
    } catch (e) {}
  }

  // Double-tap to cycle background
  let lastTapTime = 0;
  document.body.addEventListener("touchend", (e) => {
    const now = new Date().getTime();
    if (now - lastTapTime < 300) {
      currentColorIndex = (currentColorIndex + 1) % cycleColors.length;
      const hex = cycleColors[currentColorIndex];
      document.body.style.backgroundColor = hex;
      fs.writeFileSync(colorConfigPath, JSON.stringify({ hex }), "utf8");
    }
    lastTapTime = now;
  });

  function loadButtons() {
    fs.readFile(configPath, "utf8", (err, data) => {
      if (err) {
        buttons = [];
        saveButtons();
        return;
      }
      try {
        buttons = JSON.parse(data);
        renderPage();
      } catch (e) {
        console.error("Error parsing buttons.json:", e);
      }
    });
  }

  function saveButtons() {
    fs.writeFile(configPath, JSON.stringify(buttons, null, 2), err => {
      if (err) console.error("Failed to save:", err);
      renderPage();
    });
  }

  function renderPage() {
    buttonGrid.innerHTML = "";
    const start = currentPage * buttonsPerPage;
    const pageButtons = buttons.slice(start, start + buttonsPerPage);

    pageButtons.forEach((btn, i) => {
      const div = document.createElement("div");
      div.className = "button";

      if (btn.icon && btn.icon.trim()) {
        let iconPath = path.join(configDir, btn.icon);
        if (!fs.existsSync(iconPath)) {
          iconPath = path.join(__dirname, btn.icon);
        }
        div.style.backgroundImage = `url("file:///${iconPath.replace(/\\/g, "/")}")`;
      } else {
        div.textContent = btn.label;
      }

      div.onclick = () => {
        if (btn.path === "voice_command_trigger") {
          voiceAccessActive = !voiceAccessActive;
          const newIcon = voiceAccessActive ? "images/voice control on.png" : "images/voice control off.png";
          const iconPath = path.join(__dirname, newIcon);
          div.style.backgroundImage = `url("file:///${iconPath.replace(/\\/g, "/")}")`;
          exec(`powershell -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('^({LWIN}n)')"`);

          return;
        }

        if (btn.path && btn.path.trim()) {
          const trimmed = btn.path.trim();
          if (trimmed.toLowerCase().startsWith("cmd ")) {
            exec(trimmed, (err) => {
              if (err) console.error("❌ Failed to run command:", err);
            });
          } else {
            const normalizedPath = `"${trimmed}"`.replace(/\\/g, '/');
            exec(`start "" ${normalizedPath}`, (err) => {
              if (err) console.error("❌ Failed to launch path:", err);
            });
          }
        }
      };

      div.oncontextmenu = (e) => {
        e.preventDefault();
        popup.style.display = "block";
        document.getElementById("label").value = btn.label;
        document.getElementById("path").value = btn.path;
        document.getElementById("icon").value = btn.icon;
        editIndex = start + i;
      };

      div.addEventListener("dragover", (e) => {
        e.preventDefault();
        div.style.outline = "2px dashed white";
      });

      div.addEventListener("dragleave", () => {
        div.style.outline = "none";
      });

      div.addEventListener("drop", (e) => {
        e.preventDefault();
        div.style.outline = "none";

        const file = e.dataTransfer.files[0];
        if (file && /\.(png|jpe?g)$/i.test(file.name)) {
          const imagesFolder = path.join(configDir, "images");
          if (!fs.existsSync(imagesFolder)) fs.mkdirSync(imagesFolder, { recursive: true });

          const safeName = file.name.replace(/[^a-z0-9_.-]/gi, "_");
          const destPath = path.join(imagesFolder, safeName);

          fs.copyFile(file.path, destPath, (err) => {
            if (err) {
              console.error("Copy error:", err);
              return;
            }

            buttons[start + i].icon = `images/${safeName}`;
            buttons[start + i].label = "";
            saveButtons();
          });
        } else {
          console.warn("Dropped file is not a supported image type.");
        }
      });

      buttonGrid.appendChild(div);
    });
  }

  form.onsubmit = (e) => {
    e.preventDefault();
    const label = document.getElementById("label").value;
    const pathValue = document.getElementById("path").value;
    const icon = document.getElementById("icon").value;
    if (editIndex !== null) {
      buttons[editIndex] = { label, path: pathValue, icon };
      editIndex = null;
    } else {
      buttons.push({ label, path: pathValue, icon });
      currentPage = Math.floor((buttons.length - 1) / buttonsPerPage);
    }
    saveButtons();
    popup.style.display = "none";
    form.reset();
  };

  deleteBtn.onclick = () => {
    if (editIndex !== null) {
      buttons.splice(editIndex, 1);
      editIndex = null;
      saveButtons();
      popup.style.display = "none";
    }
  };

  menuBtn.onclick = () => {
    editIndex = null;
    popup.style.display = popup.style.display === "none" ? "block" : "none";
    form.reset();
  };

  nextBtn.onclick = () => {
    if ((currentPage + 1) * buttonsPerPage < buttons.length) {
      currentPage++;
      renderPage();
    }
  };

  prevBtn.onclick = () => {
    if (currentPage > 0) {
      currentPage--;
      renderPage();
    }
  };

  // Touchscreen swipe support
  let touchStartX = null;

  document.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
  }, false);

  document.addEventListener("touchend", (e) => {
    if (!touchStartX) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX;
    if (deltaX > 60 && currentPage > 0) {
      currentPage--;
      renderPage();
    } else if (deltaX < -60 && (currentPage + 1) * buttonsPerPage < buttons.length) {
      currentPage++;
      renderPage();
    }
    touchStartX = null;
  }, false);

  loadButtons();

  const dropZone = document.getElementById("icon-drop-zone");
  if (dropZone) {
    dropZone.ondragover = (e) => e.preventDefault();
    dropZone.ondrop = (event) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (!file || !file.path) return;

      const originalPath = file.path;
      const fileName = path.basename(originalPath);
      const imagesFolder = path.join(configDir, 'images');
      if (!fs.existsSync(imagesFolder)) fs.mkdirSync(imagesFolder, { recursive: true });
      const targetPath = path.join(imagesFolder, fileName);

      try {
        fs.copyFileSync(originalPath, targetPath);
        buttons[editIndex].icon = `images/${fileName}`;
        fs.writeFileSync(configPath, JSON.stringify(buttons, null, 2), 'utf8');
        renderPage(currentPage);
      } catch (err) {
        console.error("Failed to copy file:", err);
      }

      popup.style.display = "none";
    };
  }

};
