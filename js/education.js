// Waste Segregation & Education Interactive Handbook & Quiz
const WasteEducation = {
  currentTab: 'guide',
  activeCategory: 'wet',
  quizScore: 0,
  quizCurrentQuestion: 0,
  quizAnswers: {},

  categories: {
    wet: {
      name: "Organic / Wet Waste (Green Bin)",
      color: "#16a34a",
      bgLight: "#f0fdf4",
      icon: "🥬",
      description: "Biodegradable organic matter that can be composted into nutrient-rich soil.",
      dos: [
        "Vegetable peels, fruit rinds, tea bags & coffee grounds",
        "Leftover cooked and uncooked food",
        "Eggshells, meat scraps & fish bones",
        "Garden waste: leaves, grass clippings, wilted flowers",
        "Coconut shells and nut casings"
      ],
      donts: [
        "Plastic wraps, cling film, or grocery bags",
        "Diapers, sanitary napkins, or cotton swabs",
        "Liquids, oils, and chemical cleaners in bulk",
        "Pet feces or cat litter"
      ],
      disposalTip: "Drain excess liquids before disposing. Use a compostable bin liner or line your bin with old newspaper."
    },
    dry: {
      name: "Recyclable / Dry Waste (Blue Bin)",
      color: "#2563eb",
      bgLight: "#eff6ff",
      icon: "📦",
      description: "Non-biodegradable, clean, and dry recyclable packaging and everyday materials.",
      dos: [
        "Cardboard boxes, egg cartons, clean newspaper & books",
        "Plastic bottles (PET), food containers, and jugs",
        "Glass bottles, beverage jars, and drinking glasses",
        "Metal cans: aluminum beverage cans, tin food cans",
        "Clean Tetra Pak milk and juice cartons"
      ],
      donts: [
        "Greasy pizza boxes with heavy oil residue",
        "Broken ceramics or mirrored glass",
        "Single-use cutlery contaminated with food",
        "Wax-coated non-recyclable wrapper papers"
      ],
      disposalTip: "Rinse and dry food/drink containers to avoid foul odors and pest attraction before placing in the blue bin."
    },
    sanitary: {
      name: "Sanitary & Biomedical Waste (Red/Hazard Bag)",
      color: "#dc2626",
      bgLight: "#fef2f2",
      icon: "🩹",
      description: "Personal hygiene items and medical disposables requiring strict segregated handling.",
      dos: [
        "Sanitary napkins, tampons, and baby/adult diapers",
        "Used cotton balls, bandages, and gauze",
        "Expired prescription medications and blister packs",
        "Syringes and test strips (secured inside puncture-proof containers)"
      ],
      donts: [
        "Flushing hygiene products down the toilet",
        "Mixing with general household dry recyclables",
        "Leaving needles uncapped or loose in open bags"
      ],
      disposalTip: "Wrap sanitary items securely in newspapers marked with a red 'X' or place in designated sanitary bags."
    },
    ewaste: {
      name: "E-Waste & Electronics (Yellow / E-Bin)",
      color: "#d97706",
      bgLight: "#fffbeb",
      icon: "💻",
      description: "Discarded electrical and electronic equipment containing valuable and heavy metals.",
      dos: [
        "Old mobile phones, chargers, headphones & cables",
        "Laptops, computer motherboards, keyboards & mice",
        "Lithium-ion and alkaline household batteries",
        "Fluorescent CFL lamps, tube lights, and LED bulbs"
      ],
      donts: [
        "Dumping electronics into general garbage bins",
        "Burning wires or extracting metals at home",
        "Breaking mercury-containing fluorescent tubes"
      ],
      disposalTip: "Deposit old gadgets at designated municipal E-Waste collection points or authorized drop-off kiosks."
    }
  },

  quizQuestions: [
    {
      question: "Which bin should a clean, empty plastic water bottle go into?",
      options: [
        "Green Bin (Organic / Wet Waste)",
        "Blue Bin (Recyclable / Dry Waste)",
        "Red Bag (Sanitary Waste)",
        "Compost Pit"
      ],
      correct: 1,
      explanation: "Clean plastic bottles are valuable recyclables and must always be placed in the Blue (Dry) Bin."
    },
    {
      question: "What should you do with used food delivery containers before disposal?",
      options: [
        "Throw them directly into the wet waste bin",
        "Rinse and dry them, then place into the blue dry waste bin",
        "Burn them in the backyard",
        "Flush them down the sink"
      ],
      correct: 1,
      explanation: "Rinsing removes grease and food residue so the plastic or container can be successfully recycled without contamination."
    },
    {
      question: "How should sanitary napkins and baby diapers be disposed of?",
      options: [
        "Mixed with green vegetable waste",
        "Wrapped in newspaper/bag and marked for sanitary collection",
        "Flushed down the bathroom toilet",
        "Placed in the blue recycling bin"
      ],
      correct: 1,
      explanation: "Sanitary waste requires hygienic segregated handling to protect sanitation workers and prevent water system blockages."
    },
    {
      question: "Where should old mobile phone batteries and chargers be dropped?",
      options: [
        "In the kitchen wet waste bin",
        "In the open street drain",
        "At an authorized E-Waste collection point or smart kiosk",
        "In the garden soil"
      ],
      correct: 2,
      explanation: "E-waste contains heavy metals (lithium, lead) that contaminate groundwater if placed in regular trash."
    }
  ],

  showModal() {
    this.currentTab = 'guide';
    this.activeCategory = 'wet';
    this.quizCurrentQuestion = 0;
    this.quizScore = 0;
    this.quizAnswers = {};

    const container = document.getElementById("modal-container");
    if (!container) return;

    container.innerHTML = `
      <div class="sw-modal-backdrop" onclick="if(event.target === this) WasteEducation.closeModal()">
        <div class="sw-modal" style="max-width: 820px; border-radius: 16px; overflow: hidden;">
          <div class="sw-modal-header d-flex justify-content-between align-items-center" style="background: linear-gradient(135deg, #064e3b 0%, #059669 100%); color: white; padding: 18px 24px;">
            <div class="d-flex align-items-center gap-2">
              <span class="fs-4">♻️</span>
              <div>
                <h5 class="fw-bold mb-0">Waste Segregation & Sustainability Guide</h5>
                <small class="opacity-90">Official Municipal Citizen Cleanliness Handbook</small>
              </div>
            </div>
            <button class="btn-close btn-close-white" onclick="WasteEducation.closeModal()"></button>
          </div>

          <!-- Sub Header Tabs -->
          <div class="bg-light border-bottom px-4 pt-3">
            <ul class="nav nav-tabs border-0" id="edu-main-tabs">
              <li class="nav-item">
                <button class="nav-link fw-bold ${this.currentTab === 'guide' ? 'active text-success' : 'text-muted'}" onclick="WasteEducation.switchTab('guide')">
                  📚 Segregation Handbook
                </button>
              </li>
              <li class="nav-item">
                <button class="nav-link fw-bold ${this.currentTab === 'quiz' ? 'active text-success' : 'text-muted'}" onclick="WasteEducation.switchTab('quiz')">
                  🎯 Segregation Quiz Game <span class="badge bg-warning text-dark ms-1">Win Points ⭐</span>
                </button>
              </li>
            </ul>
          </div>

          <div class="sw-modal-body p-4" id="education-modal-body">
            <!-- Dynamic Content -->
          </div>

          <div class="sw-modal-footer bg-light p-3 d-flex justify-content-between align-items-center border-top">
            <small class="text-muted">🌿 Clean City Initiative • Municipal Sanitation Dept.</small>
            <button class="btn btn-secondary btn-sm px-4 fw-bold" onclick="WasteEducation.closeModal()">Close Guide</button>
          </div>
        </div>
      </div>
    `;

    this.renderContent();
  },

  switchTab(tab) {
    this.currentTab = tab;
    const tabs = document.querySelectorAll("#edu-main-tabs .nav-link");
    if (tabs.length >= 2) {
      if (tab === 'guide') {
        tabs[0].className = "nav-link fw-bold active text-success";
        tabs[1].className = "nav-link fw-bold text-muted";
      } else {
        tabs[0].className = "nav-link fw-bold text-muted";
        tabs[1].className = "nav-link fw-bold active text-success";
      }
    }
    this.renderContent();
  },

  renderContent() {
    const body = document.getElementById("education-modal-body");
    if (!body) return;

    if (this.currentTab === 'guide') {
      this.renderGuide(body);
    } else {
      this.renderQuiz(body);
    }
  },

  selectCategory(catKey) {
    this.activeCategory = catKey;
    const body = document.getElementById("education-modal-body");
    if (body) this.renderGuide(body);
  },

  renderGuide(container) {
    const cat = this.categories[this.activeCategory] || this.categories.wet;

    container.innerHTML = `
      <div>
        <!-- Category Selector Pills -->
        <div class="row g-2 mb-4">
          ${Object.entries(this.categories).map(([key, data]) => `
            <div class="col-6 col-md-3">
              <button class="btn w-100 p-2 text-start d-flex align-items-center gap-2 border ${this.activeCategory === key ? 'shadow-sm' : ''}" style="border-radius: 10px; background: ${this.activeCategory === key ? data.bgLight : '#ffffff'}; border-color: ${this.activeCategory === key ? data.color : '#e2e8f0'} !important; transition: all 0.2s ease;" onclick="WasteEducation.selectCategory('${key}')">
                <span class="fs-4">${data.icon}</span>
                <div style="line-height: 1.1;">
                  <strong style="font-size: 0.85rem; color: ${this.activeCategory === key ? data.color : '#334155'};">${key.toUpperCase()}</strong>
                  <div class="text-muted" style="font-size: 0.72rem;">${data.name.split('(')[0].trim()}</div>
                </div>
              </button>
            </div>
          `).join("")}
        </div>

        <!-- Selected Category Detail Card -->
        <div class="p-4 rounded border mb-3" style="background: ${cat.bgLight}; border-color: ${cat.color}33 !important;">
          <div class="d-flex align-items-center gap-3 mb-2">
            <span style="font-size: 2.2rem;">${cat.icon}</span>
            <div>
              <h5 class="fw-bold mb-1" style="color: ${cat.color};">${cat.name}</h5>
              <p class="small text-secondary mb-0">${cat.description}</p>
            </div>
          </div>
        </div>

        <!-- Do's and Don'ts Grid -->
        <div class="row g-3 mb-3">
          <div class="col-12 col-md-6">
            <div class="p-3 bg-white rounded border h-100 shadow-sm border-start border-4 border-success">
              <h6 class="fw-bold text-success mb-2 d-flex align-items-center gap-1">
                <span>✓</span> DO INCLUDE:
              </h6>
              <ul class="small text-secondary ps-3 mb-0" style="line-height: 1.6;">
                ${cat.dos.map(item => `<li>${item}</li>`).join("")}
              </ul>
            </div>
          </div>

          <div class="col-12 col-md-6">
            <div class="p-3 bg-white rounded border h-100 shadow-sm border-start border-4 border-danger">
              <h6 class="fw-bold text-danger mb-2 d-flex align-items-center gap-1">
                <span>✕</span> DO NOT INCLUDE:
              </h6>
              <ul class="small text-secondary ps-3 mb-0" style="line-height: 1.6;">
                ${cat.donts.map(item => `<li>${item}</li>`).join("")}
              </ul>
            </div>
          </div>
        </div>

        <!-- Disposal Tip -->
        <div class="alert alert-info py-2 px-3 small d-flex align-items-center gap-2 mb-0" style="border-radius: 8px;">
          <span class="fs-5">💡</span>
          <div><strong>Pro-Tip:</strong> ${cat.disposalTip}</div>
        </div>
      </div>
    `;
  },

  renderQuiz(container) {
    const totalQ = this.quizQuestions.length;

    if (this.quizCurrentQuestion >= totalQ) {
      const pct = Math.round((this.quizScore / totalQ) * 100);
      container.innerHTML = `
        <div class="text-center py-4">
          <div class="display-3 mb-2">${pct >= 75 ? '🏆' : '🌱'}</div>
          <h4 class="fw-bold text-dark mb-1">Quiz Completed!</h4>
          <p class="text-muted small mb-3">You scored <strong>${this.quizScore} out of ${totalQ}</strong> (${pct}%)</p>

          <div class="p-3 bg-light rounded border max-w-md mx-auto mb-4" style="max-width: 440px; margin: 0 auto;">
            <div class="d-flex justify-content-between align-items-center mb-1 small">
              <span>Segregation Proficiency:</span>
              <strong class="${pct >= 75 ? 'text-success' : 'text-primary'}">${pct >= 75 ? 'Certified Eco Champion ⭐' : 'Practicing Eco Scout 🌿'}</strong>
            </div>
            <div class="progress mb-2" style="height: 10px;">
              <div class="progress-bar ${pct >= 75 ? 'bg-success' : 'bg-primary'}" style="width: ${pct}%;"></div>
            </div>
            <small class="text-muted">Thanks for mastering civic waste segregation guidelines!</small>
          </div>

          <div class="d-flex justify-content-center gap-2">
            <button class="btn btn-outline-success fw-bold btn-sm px-4" onclick="WasteEducation.restartQuiz()">
              ↻ Retake Quiz
            </button>
            <button class="btn btn-success fw-bold btn-sm px-4" onclick="WasteEducation.switchTab('guide')">
              📚 Review Handbook
            </button>
          </div>
        </div>
      `;
      return;
    }

    const q = this.quizQuestions[this.quizCurrentQuestion];
    const userSelected = this.quizAnswers[this.quizCurrentQuestion];
    const isAnswered = userSelected !== undefined;

    container.innerHTML = `
      <div style="max-width: 650px; margin: 0 auto;">
        <!-- Progress Bar -->
        <div class="d-flex justify-content-between align-items-center mb-2 small text-muted">
          <span>Question ${this.quizCurrentQuestion + 1} of ${totalQ}</span>
          <span>Score: <strong>${this.quizScore} pts</strong></span>
        </div>
        <div class="progress mb-4" style="height: 6px;">
          <div class="progress-bar bg-success" style="width: ${((this.quizCurrentQuestion + 1) / totalQ) * 100}%;"></div>
        </div>

        <!-- Question Prompt -->
        <div class="sw-card p-3 mb-3 border shadow-sm">
          <h6 class="fw-bold text-dark mb-0">${q.question}</h6>
        </div>

        <!-- Options -->
        <div class="d-flex flex-column gap-2 mb-3">
          ${q.options.map((opt, optIdx) => {
            let btnClass = "btn btn-outline-secondary text-start p-3 fw-medium";
            let icon = `<span class="badge bg-light text-dark border me-2">${String.fromCharCode(65 + optIdx)}</span>`;

            if (isAnswered) {
              if (optIdx === q.correct) {
                btnClass = "btn btn-success text-white text-start p-3 fw-bold border-success";
                icon = `<span class="badge bg-white text-success me-2">✓</span>`;
              } else if (optIdx === userSelected) {
                btnClass = "btn btn-danger text-white text-start p-3 fw-bold border-danger";
                icon = `<span class="badge bg-white text-danger me-2">✕</span>`;
              } else {
                btnClass = "btn btn-light text-muted text-start p-3 border opacity-50";
              }
            }

            return `
              <button class="${btnClass}" style="border-radius: 10px; transition: all 0.15s ease;" ${isAnswered ? 'disabled' : ''} onclick="WasteEducation.submitQuizAnswer(${optIdx})">
                ${icon}
                ${opt}
              </button>
            `;
          }).join("")}
        </div>

        <!-- Explanation & Next Button -->
        ${isAnswered ? `
          <div class="p-3 bg-light rounded border mb-3 small">
            <strong>${userSelected === q.correct ? '🎉 Correct!' : '⚠️ Incorrect!'}</strong> ${q.explanation}
          </div>
          <div class="d-flex justify-content-end">
            <button class="btn btn-primary fw-bold px-4" onclick="WasteEducation.nextQuizQuestion()">
              ${this.quizCurrentQuestion + 1 >= totalQ ? 'See Final Score →' : 'Next Question →'}
            </button>
          </div>
        ` : ''}
      </div>
    `;
  },

  submitQuizAnswer(optIdx) {
    const q = this.quizQuestions[this.quizCurrentQuestion];
    this.quizAnswers[this.quizCurrentQuestion] = optIdx;
    if (optIdx === q.correct) {
      this.quizScore += 1;
    }
    const body = document.getElementById("education-modal-body");
    if (body) this.renderQuiz(body);
  },

  nextQuizQuestion() {
    this.quizCurrentQuestion += 1;
    const body = document.getElementById("education-modal-body");
    if (body) this.renderQuiz(body);
  },

  restartQuiz() {
    this.quizCurrentQuestion = 0;
    this.quizScore = 0;
    this.quizAnswers = {};
    const body = document.getElementById("education-modal-body");
    if (body) this.renderQuiz(body);
  },

  closeModal() {
    const container = document.getElementById("modal-container");
    if (container) container.innerHTML = "";
  }
};
