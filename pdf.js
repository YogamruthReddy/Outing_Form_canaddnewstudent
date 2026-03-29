function downloadPDF() {
    const select = document.getElementById("studentSelect");
    if (!select || !select.value) {
        alert("Please select a student");
        return;
    }

    // Use the runtime 'allStudents' array which contains both file data + local additions
    // Fallback to window.students if allStudents isn't ready
    const sourceData = (typeof allStudents !== 'undefined' && allStudents.length > 0) ? allStudents : window.students;
    const s = sourceData[Number(select.value)];
    if (!s) {
        alert("Invalid student selected");
        return;
    }

    const element = document.getElementById("preview");
    if (!element) {
        alert("Preview not found");
        return;
    }

    window.scrollTo(0, 0);

    html2pdf()
        .from(element)
        .set({
            filename: `${s.name.replace(/\s+/g, "")}_${s.id}.pdf`,
            margin: 0,

            image: {
                type: "jpeg",
                quality: 0.95
            },

            html2canvas: {
                scale: 1,          // 🔒 DO NOT CHANGE
                useCORS: true,
                scrollY: 0
            },

            jsPDF: {
                unit: "mm",
                format: "a4",
                orientation: "portrait"
            },

            pagebreak: {
                mode: ["css"]      // 🔥 REQUIRED
            }
        })
        .save()
        .catch(err => {
            console.error(err);
            alert("PDF generation failed");
        });
}
