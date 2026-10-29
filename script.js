
function getSupabaseClient() {
  return (
    window.supabaseClient ||
    window.supabaseClientInstance ||
    window.db ||
    null
  );
}

const teamForm = document.getElementById("team-form");
const teamNameInput = document.getElementById("team-name");
const projectTitleInput = document.getElementById("project-title");
const topicTitleInput = document.getElementById("topic-title");
const membersList = document.getElementById("members-list");
const addMemberButton = document.getElementById("add-member");
const submitButton = document.getElementById("submit-button");
const formMessage = document.getElementById("form-message");
const topicGrid = document.getElementById("topic-grid");
const registrationPreview = document.getElementById("registration-preview");
const registrationDetails = document.getElementById("registration-details");

const projectForm = document.getElementById("project-form");
const projectSubmitButton = document.getElementById("project-submit-button");
const projectMessage = document.getElementById("project-message");
const projectGallery = document.getElementById("project-gallery");
const galleryMessage = document.getElementById("gallery-message");

function showMessage(element, message, type = "") {
  if (!element) return;

  element.textContent = message;
  element.className = `form-message ${type}`.trim();
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

// ==========================================
// TEAM MEMBER FORM
// ==========================================

function addMemberRow(name = "", role = "Frontend Developer") {
  if (!membersList) return;

  const row = document.createElement("div");
  row.className = "member-row";

  row.innerHTML = `
    <input
      type="text"
      class="member-name"
      placeholder="Member name"
      maxlength="100"
      required
      aria-label="Member name"
    >

    <select class="member-role" aria-label="Member role">
      <option value="Team Lead">Team Lead</option>
      <option value="UI/UX Designer">UI/UX Designer</option>
      <option value="Frontend Developer">Frontend Developer</option>
      <option value="Tester">Tester</option>
      <option value="Presenter">Presenter</option>
    </select>

    <button
      type="button"
      class="remove-member"
      aria-label="Remove member"
    >×</button>
  `;

  row.querySelector(".member-name").value = name;
  row.querySelector(".member-role").value = role;

  row.querySelector(".remove-member").addEventListener("click", () => {
    if (membersList.children.length <= 2) {
      showMessage(
        formMessage,
        "A team must have at least 2 members.",
        "error"
      );
      return;
    }

    row.remove();
    updateMemberControls();
  });

  membersList.appendChild(row);
  updateMemberControls();
}

function updateMemberControls() {
  if (!membersList || !addMemberButton) return;

  const count = membersList.children.length;

  addMemberButton.disabled = count >= 10;

  membersList.querySelectorAll(".remove-member").forEach((button) => {
    button.disabled = count <= 2;
  });
}

function getMembers() {
  if (!membersList) return [];

  return [...membersList.querySelectorAll(".member-row")].map((row) => ({
    name: row.querySelector(".member-name").value.trim(),
    role: row.querySelector(".member-role").value
  }));
}

function validateMembers(members) {
  if (members.length < 2 || members.length > 10) {
    return "Please add between 2 and 10 team members.";
  }

  if (members.some((member) => !member.name)) {
    return "Please enter a name for every team member.";
  }

  const names = members.map((member) => member.name.toLowerCase());

  if (new Set(names).size !== names.length) {
    return "Each team member must have a different name.";
  }

  const leads = members.filter(
    (member) => member.role === "Team Lead"
  ).length;

  if (leads !== 1) {
    return "Please assign exactly one Team Lead.";
  }

  return "";
}

// ==========================================
// REGISTERED TEAM CARDS
// ==========================================

function renderTopics(teams) {
  if (!topicGrid) return;

  if (!teams || teams.length === 0) {
    topicGrid.innerHTML = `
      <div class="empty-teams">
        <h3>No teams registered yet</h3>
        <p>Be the first team to register for the workshop!</p>
      </div>
    `;
    return;
  }

  topicGrid.innerHTML = teams.map((team) => {
    const members = team.team_members || [];

    const memberCards = members.map((member) => `
      <div class="registered-member">
        <span class="member-avatar" aria-hidden="true">
          ${escapeHTML(
            (member.member_name || "?").charAt(0).toUpperCase()
          )}
        </span>

        <div>
          <strong>${escapeHTML(member.member_name)}</strong>
          <p>${escapeHTML(member.role)}</p>
        </div>
      </div>
    `).join("");

    const registeredDate = team.created_at
      ? new Date(team.created_at).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric"
        })
      : "Date unavailable";

    const topic = Array.isArray(team.topics)
      ? team.topics[0]
      : team.topics;

    return `
      <article class="topic-card registered-team-card">
        <p class="eyebrow">Registered team</p>

        <h3>${escapeHTML(team.team_name)}</h3>

        <p>
          <strong>Project:</strong>
          ${escapeHTML(team.project_title)}
        </p>

        <p>
          <strong>Topic:</strong>
          ${escapeHTML(topic?.title || "Workshop topic")}
        </p>

        <p class="team-registration-date">
          Registered: ${escapeHTML(registeredDate)}
        </p>

        <div class="registered-members">
          <h4>Team members (${members.length})</h4>
          ${memberCards}
        </div>
      </article>
    `;
  }).join("");
}


async function loadTopics() {
  const client = getSupabaseClient();

  if (!client || !topicGrid) return;

  topicGrid.innerHTML = "<p>Loading registered teams...</p>";

  try {
    const [
      { data: teams, error: teamsError },
      { data: topics, error: topicsError },
      { data: members, error: membersError }
    ] = await Promise.all([
      client
        .from("teams")
        .select("id, team_name, project_title, topic_id, created_at")
        .order("created_at", { ascending: false }),

      client
        .from("topics")
        .select("id, title"),

      client
        .from("team_members")
        .select("team_id, member_name, role")
    ]);

    if (teamsError) throw teamsError;
    if (topicsError) throw topicsError;
    if (membersError) throw membersError;

    const topicMap = new Map(
      (topics || []).map(topic => [topic.id, topic])
    );

    const membersMap = new Map();

    (members || []).forEach(member => {
      if (!membersMap.has(member.team_id)) {
        membersMap.set(member.team_id, []);
      }

      membersMap.get(member.team_id).push({
        member_name: member.member_name,
        role: member.role
      });
    });

    const completeTeams = (teams || []).map(team => ({
      ...team,
      topics: topicMap.get(team.topic_id) || null,
      team_members: membersMap.get(team.id) || []
    }));

    console.log("Registered teams loaded:", completeTeams);

    renderTopics(completeTeams);

  } catch (error) {
    console.error("Unable to load registered teams:", error);

    topicGrid.innerHTML = `
      <div class="empty-teams">
        <h3>Teams could not be loaded</h3>
        <p>${escapeHTML(error.message || "Check Supabase read permissions.")}</p>
      </div>
    `;
  }
}

// ==========================================
// REGISTRATION SUCCESS PANEL
// ==========================================

function showRegistrationSuccess(
  result,
  teamName,
  projectTitle,
  members
) {
  if (!registrationPreview || !registrationDetails) return;

  registrationPreview.hidden = false;

  const topic = result.topic_title || topicTitleInput.value.trim();
  const teamId = result.team_id;

  const memberCards = members.map((member) => `
    <div class="registered-member">
      <span class="member-avatar" aria-hidden="true">
        ${escapeHTML(member.name.charAt(0).toUpperCase())}
      </span>

      <div>
        <strong>${escapeHTML(member.name)}</strong>
        <p>${escapeHTML(member.role)}</p>
      </div>
    </div>
  `).join("");

  registrationDetails.innerHTML = `
    <article class="topic-card registered-team-card">
      <p class="eyebrow">Registration successful</p>

      <h3>${escapeHTML(teamName)}</h3>

      <p>
        <strong>Project:</strong>
        ${escapeHTML(projectTitle)}
      </p>

      <p>
        <strong>Topic:</strong>
        ${escapeHTML(topic)}
      </p>

      <div class="registered-members">
        <h4>Team members (${members.length})</h4>
        ${memberCards}
      </div>

      <p><strong>Registration ID</strong></p>
      <p class="registration-id">${escapeHTML(teamId)}</p>

      <button
        type="button"
        class="button button-secondary"
        id="copy-registration-id"
      >
        Copy registration ID
      </button>
    </article>
  `;

  const copyButton = document.getElementById("copy-registration-id");

  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(teamId);

        showMessage(
          formMessage,
          "Registration ID copied. Keep it safe!",
          "success"
        );
      } catch {
        showMessage(
          formMessage,
          `Your registration ID is: ${teamId}`,
          "success"
        );
      }
    });
  }

  const registrationIdInput = document.getElementById("registration-id");

  if (registrationIdInput) {
    registrationIdInput.value = teamId;
  }

  registrationPreview.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}

// ==========================================
// REGISTER TEAM
// ==========================================

async function registerTeam(event) {
  event.preventDefault();

  const client = getSupabaseClient();

  if (!client) {
    showMessage(
      formMessage,
      "Supabase is not configured. Check supabase-config.js.",
      "error"
    );
    return;
  }

  const teamName = teamNameInput.value.trim();
  const projectTitle = projectTitleInput.value.trim();
  const topicTitle = topicTitleInput.value.trim();
  const members = getMembers();

  const validationError = validateMembers(members);

  if (validationError) {
    showMessage(formMessage, validationError, "error");
    return;
  }

  if (topicTitle.length < 3 || topicTitle.length > 100) {
    showMessage(
      formMessage,
      "Your topic must be between 3 and 100 characters.",
      "error"
    );
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Registering...";

  showMessage(
    formMessage,
    "Checking your topic and registering the team..."
  );

  try {
    const { data, error } = await client.rpc(
      "register_custom_workshop_team",
      {
        p_team_name: teamName,
        p_project_title: projectTitle,
        p_topic_title: topicTitle,
        p_members: members
      }
    );

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;

    if (!result || result.success !== true) {
      showMessage(
        formMessage,
        result?.message ||
          "Registration could not be completed. Please try another topic.",
        "error"
      );
      return;
    }

    showMessage(
      formMessage,
      result.message || "Team registered successfully!",
      "success"
    );

    showRegistrationSuccess(
      result,
      teamName,
      projectTitle,
      members
    );

    // Clear the form after successful registration.
    teamForm.reset();
    membersList.innerHTML = "";

    addMemberRow("", "Team Lead");
    addMemberRow("", "Frontend Developer");

    // Reload all teams from Supabase, including the new team.
    await loadTopics();

  } catch (error) {
    console.error("Team registration failed:", error);

    const message = error?.message ||
      "Something went wrong during registration.";

    if (/similar|duplicate|already exists|unique/i.test(message)) {
      showMessage(
        formMessage,
        "This topic or team name may already exist, or the idea is too similar. Please try a more distinct topic or team name.",
        "error"
      );
    } else {
      showMessage(
        formMessage,
        `${message} Please check the Supabase migration and try again.`,
        "error"
      );
    }
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Register team";
  }
}

// ==========================================
// SUBMIT FINAL PROJECT
// ==========================================

async function submitProject(event) {
  event.preventDefault();

  const client = getSupabaseClient();

  if (!client) {
    showMessage(
      projectMessage,
      "Supabase is not configured. Check supabase-config.js.",
      "error"
    );
    return;
  }

  const teamId = document.getElementById("registration-id").value.trim();
  const websiteUrl = document.getElementById("website-url").value.trim();
  const description = document.getElementById("project-description").value.trim();
  const screenshotUrl = document.getElementById("screenshot-url").value.trim();

  if (description.length < 30 || description.length > 2000) {
    showMessage(
      projectMessage,
      "The description must be between 30 and 2000 characters.",
      "error"
    );
    return;
  }

  projectSubmitButton.disabled = true;
  projectSubmitButton.textContent = "Submitting...";

  showMessage(
    projectMessage,
    "Submitting your project for review..."
  );

  try {
    const { data, error } = await client.rpc(
      "submit_workshop_project",
      {
        p_team_id: teamId,
        p_website_url: websiteUrl,
        p_project_description: description,
        p_screenshot_url: screenshotUrl
      }
    );

    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;

    if (!result || result.success !== true) {
      showMessage(
        projectMessage,
        result?.message || "Project submission failed.",
        "error"
      );
      return;
    }

    showMessage(
      projectMessage,
      result.message || "Project submitted for admin approval.",
      "success"
    );

    projectForm.reset();

    await loadApprovedProjects();

  } catch (error) {
    console.error("Project submission failed:", error);

    showMessage(
      projectMessage,
      error?.message ||
        "Project submission failed. Check the registration ID and Supabase migration.",
      "error"
    );
  } finally {
    projectSubmitButton.disabled = false;
    projectSubmitButton.textContent = "Submit final project";
  }
}

// ==========================================
// APPROVED PROJECT GALLERY
// ==========================================


async function loadApprovedProjects() {
  const client = getSupabaseClient();

  if (!client || !projectGallery) return;

  projectGallery.innerHTML = "<p>Loading approved projects...</p>";
  showMessage(galleryMessage, "");

  const { data, error } = await client
    .from("submissions")
    .select(`
      id,
      website_url,
      project_description,
      submitted_at,
      teams!inner (
        id,
        team_name,
        project_title,
        topics (
          title
        )
      )
    `)
    .eq("status", "approved")
    .order("submitted_at", { ascending: false });

  if (error) {
    console.error("Unable to load approved projects:", error);

    projectGallery.innerHTML =
      "<p>Projects could not be loaded right now.</p>";

    showMessage(
      galleryMessage,
      "Please check the Supabase table permissions and relationships.",
      "error"
    );
    return;
  }

  if (!data || data.length === 0) {
    projectGallery.innerHTML =
      "<p>No approved projects yet. Check back soon!</p>";
    return;
  }

  projectGallery.innerHTML = data.map((project) => {
    const team = project.teams || {};

    const topic = Array.isArray(team.topics)
      ? team.topics[0]
      : team.topics;

    // Allow only valid HTTP or HTTPS website URLs.
    let safeWebsiteUrl = "";

    try {
      const parsedUrl = new URL(project.website_url);

      if (
        parsedUrl.protocol === "https:" ||
        parsedUrl.protocol === "http:"
      ) {
        safeWebsiteUrl = parsedUrl.href;
      }
    } catch {
      // Invalid URL: show a message instead of an iframe.
    }

    const preview = safeWebsiteUrl
      ? `
        <div class="project-preview">
          <div class="preview-browser-bar">
            <span></span>
            <span></span>
            <span></span>
            <p>Live website preview</p>
          </div>

          <iframe
            class="project-preview-frame"
            src="${escapeHTML(safeWebsiteUrl)}"
            title="Preview of ${escapeHTML(
              team.project_title || "student project"
            )}"
            loading="lazy"
            sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerpolicy="no-referrer"
          ></iframe>
        </div>
      `
      : `
        <div class="project-preview project-preview-unavailable">
          <p>Live preview is unavailable for this project.</p>
        </div>
      `;

    const websiteLink = safeWebsiteUrl
      ? `
        <a
          class="project-visit-link"
          href="${escapeHTML(safeWebsiteUrl)}"
          target="_blank"
          rel="noopener noreferrer"
        >
          Visit Full Website ↗
        </a>
      `
      : "";

    return `
      <article class="topic-card project-card">

        ${preview}

        <p class="eyebrow">Approved project</p>

        <h3>${escapeHTML(
          team.project_title || "Student project"
        )}</h3>

        <p>
          <strong>Team:</strong>
          ${escapeHTML(team.team_name || "Workshop team")}
        </p>

        <p>
          <strong>Topic:</strong>
          ${escapeHTML(topic?.title || "Workshop project")}
        </p>

        <p>${escapeHTML(project.project_description)}</p>

        ${websiteLink}

      </article>
    `;
  }).join("");
}


// ==========================================
// INITIALISE PAGE
// ==========================================

if (addMemberButton) {
  addMemberButton.addEventListener("click", () => {
    if (membersList.children.length >= 10) {
      showMessage(
        formMessage,
        "A team can have at most 10 members.",
        "error"
      );
      return;
    }

    addMemberRow();
    showMessage(formMessage, "");
  });
}

if (teamForm) {
  teamForm.addEventListener("submit", registerTeam);
}

if (projectForm) {
  projectForm.addEventListener("submit", submitProject);
}

addMemberRow("", "Team Lead");
addMemberRow("", "Frontend Developer");

loadTopics();
loadApprovedProjects();
