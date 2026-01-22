document.addEventListener("DOMContentLoaded", () => {
  // ano no rodapé
  const yearSpan = document.getElementById("year");
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // scroll suave (se algum dia usar links internos tipo #skills etc)
  const links = document.querySelectorAll('a[href^="#"]');
  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href");
      if (!id || id.length <= 1) return;

      const target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth" });
    });
  });

  // progresso das certificações usando data-progress
  const certBlocks = document.querySelectorAll(".cert-progress");
  certBlocks.forEach((block) => {
    const raw = block.getAttribute("data-progress") || "0";
    let value = Number(raw);
    if (Number.isNaN(value)) value = 0;
    value = Math.max(0, Math.min(100, value)); // clamp 0–100

    const fill = block.querySelector(".cert-progress-fill");
    const text = block.querySelector(".cert-progress-text");

    if (fill) {
      fill.style.width = `${value}%`;
    }
    if (text) {
      text.textContent = `progress: ${value}%`;
    }

    // também atualiza o --cert-progress da cert pra animar a imagem
    const certItem = block.closest(".cert-item");
    if (certItem) {
      certItem.style.setProperty("--cert-progress", `${value}%`);
    }
  });
});
