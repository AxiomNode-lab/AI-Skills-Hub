document.querySelectorAll(".copy-command").forEach(button => {
  button.addEventListener("click", async () => {
    const command = button.getAttribute("data-copy") || "";
    try {
      await navigator.clipboard.writeText(command);
      button.textContent = "Copied";
      window.setTimeout(() => { button.textContent = "Copy install command"; }, 1500);
    } catch {
      button.textContent = "Select the command above to copy";
    }
  });
});
