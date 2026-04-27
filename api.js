async function getAi(input, model) {
  const message = `
        Du bist ein hilfreicher Assistent. Du hast die Aufgabe, das Foto zu analysieren und dann zu sagen um welche Art von Müll es sich handelt und in welchen Behälter er gehört. Hier ist das Foto:
        ${input}
        `.trim();

  try {
    let data;
    const res = await fetch("http://localhost:1234/api/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        input: message,
      }),
    });

    data = await res.json();
    console.log(data.output[0].content);
    return (reply = data.output[0].content);
  } catch (err) {
    console.log("Fehler", err.message);
    if (err.message == "NetworkError when attempting to fetch resource.") {
      alert(
        "Fehler: Möglicherweise ist der Server nicht erreichbar. Bitte stelle sicher, dass der Server läuft und versuche es erneut.",
      );
    }
  }
}
