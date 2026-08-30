import { useNavigate } from "react-router-dom";
import Layout from "./Layout";
import {
    Box, Typography, IconButton, Accordion, AccordionSummary, AccordionDetails,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const SECTIONS = [
    {
        title: "Rzut serwerowni",
        body: [
            "Widok główny (\"/\" i \"/rzut\") pokazuje pomieszczenie z szafami. Świeży rzut startuje bez czujników — dodajesz je sam.",
            "Przytrzymaj ikonkę czujnika w pasku (🔥💨💧👁) i przeciągnij w wybrane miejsce na rzucie, żeby go postawić.",
            "Przeciągnij szafę lub postawiony czujnik lewym przyciskiem myszy, żeby zmienić jego pozycję — czujnik można przesuwać dowolnie po pokoju (X i głębokość naraz).",
            "Kliknięcie (bez przeciągnięcia) w postawiony czujnik pożaru/gazu/ruchu zaznacza go i pokazuje strzałki ▲/▼ obok — regulują wysokość montażu niezależnie od przesuwania w poziomie. Czujnik zalania zawsze stoi na podłodze (bez regulacji wysokości).",
            "Prawy klik na czujniku go usuwa.",
            "Dwuklik w szafę otwiera jej widok szczegółowy. Dwuklik w czujnik pożaru/gazu/zalania/drzwi otwiera stronę tego czujnika (test alarmu, kasowanie).",
            "Przycisk \"Zapisz układ\" zapisuje bieżące rozmieszczenie na stałe.",
        ],
    },
    {
        title: "Widok szafy (rack)",
        body: [
            "Wejdź w szafę dwuklikiem z rzutu głównego.",
            "Ikonka ✎ edytuje slot: typ urządzenia, nazwa, wysokość (co 0,5U) i adres management.",
            "Ikonka kosza usuwa urządzenie ze slotu (zwalnia miejsce).",
            "Ikonka 🔗 otwiera adres management w nowej karcie (aktywna tylko gdy ustawiony).",
            "Ikonka ping wysyła realny ping na adres management i pokazuje wynik OK/BRAK.",
            "Panel po lewej to wizualny podgląd szafy — kliknięcie ikon 🌡️/💧 przy urządzeniu pokazuje historię temperatury/wilgotności tego slotu.",
            "Na stronie historii temperatury/wilgotności są dwa niezależne poziomy progu: Non-Critical (ostrzeżenie) i Critical — każdy z własnym min/max, własnym alarmem i przyciskiem Symuluj/Skasuj.",
            "Przełącznik \"Czujnik podłączony\" na górze tej strony wyłącza globalnie mock i alarmy temp./wilg. we wszystkich szafach naraz (nie ma per-unit realnego czujnika, tylko wspólny mock) — przydatne, dopóki nie podłączysz realnych czujników per slot.",
            "\"Opóźnienie alarmu\" — odczyt musi być poza progiem przez tyle sekund zanim alarm faktycznie się włączy (0 = natychmiast).",
            "Powrót odczytu w normę wysyła jednorazowy log/powiadomienie (jeśli włączone w regule), ale nie kasuje alarmu automatycznie — to zawsze ręczna akcja.",
            "Pasek pod wartością pokazuje graficznie gdzie odczyt leży względem progów (czerwono-zielono-czerwono). Niżej: najniższy/najwyższy zanotowany odczyt z datą i przycisk \"Wyczyść rekordy\".",
            "Wykres ma przełącznik zakresu (Na żywo / 24h / tydzień / miesiąc) i przycisk \"Wyczyść wykres\" kasujący zapisaną historię tego slotu.",
        ],
    },
    {
        title: "Powiadomienia (Ustawienia)",
        body: [
            "W Ustawieniach → sekcja \"Powiadomienia\" tworzysz grupy mailowe i SMS (nazwa + lista adresów/numerów).",
            "Tabela reguł przypisuje grupę do zdarzenia (pożar/gaz/zalanie/drzwi/próg temp.-wilg. szafy/napięcie zasilania) i włącza kanał (e-mail/SMS) osobno.",
            "\"Napięcie zasilania\" w menu bocznym pokazuje bieżącą wartość, pozwala ustawić progi min/max i ma własny przycisk testu/kasowania alarmu — tak samo jak inne czujniki. Przełącznik \"Czujnik podłączony\" wyłącza mock i alarmy, gdy nie masz podpiętego realnego czujnika napięcia — tak samo działa na stronie temperatury/wilgotności per-slot w szafie (patrz sekcja \"Widok szafy\").",
            "Konfiguracja serwera SMTP (host/port/login/hasło/nadawca) jest w Ustawieniach → sekcja \"SMTP\" — nie w pliku .env. Jest tam też przycisk do wysłania testowego e-maila.",
            "Każda grupa mailowa/SMS ma własny harmonogram (\"Harmonogram wysyłki\") — siatka dzień×godzina określająca, kiedy powiadomienia faktycznie wychodzą (alarm zawsze się loguje, niezależnie od harmonogramu).",
            "Reguła powiadomień może mieć własny temat e-maila (\"Własny temat e-mail\") i dołączać zdjęcie z kamery do wiadomości (\"Załącz zdjęcie z kamery\").",
            "Dwuklik w czujnik na rzucie (pożar/gaz/zalanie/drzwi) otwiera jego stronę z przyciskiem \"Symuluj alarm (test)\" — realnie wysyła powiadomienie do przypisanej grupy, żeby sprawdzić czy działa.",
            "Czujnik świeci na czerwono aż do ręcznego skasowania przyciskiem \"Skasuj alarm\" na tej samej stronie, nawet jeśli warunek alarmowy sam ustąpił.",
            "SMS jest na razie zamockowany (log w konsoli backendu).",
            "\"Kopia zapasowa konfiguracji\" (na dole Ustawień) eksportuje/importuje ustawienia, progi, grupy i reguły jako plik JSON — bez kont użytkowników, logów i historii odczytów.",
        ],
    },
    {
        title: "Kamera i nagrania",
        body: [
            "\"Widok z kamery\" pokazuje podgląd na żywo i pozwala ręcznie rozpocząć/zatrzymać nagrywanie.",
            "Przy wykryciu ruchu nagrywanie startuje automatycznie.",
            "\"Zapisane wideo\" to lista nagrań pogrupowana po dniach, z możliwością odtworzenia i usunięcia.",
        ],
    },
    {
        title: "Logi systemowe",
        body: [
            "\"Logi z systemu\" pokazuje jedną, wspólną historię zdarzeń — alarmy, logowania/wylogowania i start systemu — z możliwością filtrowania po kategorii i sortowania.",
            "Skasowanie alarmu (patrz sekcja Powiadomienia) też zapisuje wpis w logu, wraz z nazwą użytkownika który to zrobił.",
            "Logowanie i wylogowanie każdego użytkownika, w tym nieudane próby logowania, trafiają do tego samego logu.",
            "Przycisk \"Pobierz logi\" eksportuje aktualnie widoczną (przefiltrowaną) listę do pliku CSV.",
        ],
    },
];

export default function Help() {
    const navigate = useNavigate();
    return (
        <Layout>
            <Box sx={{ p: 2, maxWidth: 800, mx: "auto" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <IconButton size="small" onClick={() => navigate("/")}>
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="h5" fontWeight="bold" sx={{ color: "#1a1a2e" }}>
                        Pomoc
                    </Typography>
                </Box>

                {SECTIONS.map(section => (
                    <Accordion key={section.title} defaultExpanded={section === SECTIONS[0]}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography fontWeight="bold">{section.title}</Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ textAlign: "left" }}>
                            {section.body.map((line, i) => (
                                <Typography variant="body2" sx={{ mb: 1.25 }} key={i}>
                                    {line}
                                </Typography>
                            ))}
                        </AccordionDetails>
                    </Accordion>
                ))}
            </Box>
        </Layout>
    );
}
