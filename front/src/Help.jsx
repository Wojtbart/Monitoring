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
            "Widok główny (\"/\" i \"/floor-plan\") pokazuje pomieszczenie z szafami. Świeży rzut startuje bez czujników — dodajesz je sam.",
            "Przytrzymaj etykietę \"sufit\"/\"ściana\" przy ikonce czujnika w pasku i przeciągnij w wybrane miejsce na rzucie, żeby go postawić. Pożar/gaz/ruch mają po dwa warianty montażu; zalanie tylko podłogowy.",
            "Przeciągnij szafę lub postawiony czujnik lewym przyciskiem myszy, żeby zmienić jego pozycję — czujnik można przesuwać dowolnie po pokoju (X i głębokość naraz).",
            "Prawy klik na dodanym czujniku (pożar/gaz/zalanie/ruch) otwiera menu kontekstowe: \"Konfiguruj\" (strona tego czujnika — test alarmu, potwierdzanie) i \"Usuń\". Klik gdziekolwiek indziej zamyka menu bez zmian.",
            "Dwuklik w szafę otwiera jej widok szczegółowy. Wbudowany czujnik drzwi (nie da się go przesunąć ani usunąć) otwiera swoją stronę dwuklikiem.",
            "Na każdej aktywnej szafie widoczne są dwie małe ikonki 🌡️/💧 — to bieżąca temperatura/wilgotność tej szafy (jeden czujnik na całą szafę, nie na urządzenie). Kliknięcie w jedną z nich przenosi na stronę historii tego czujnika.",
            "Prawy klik na szafie otwiera menu \"Zmień nazwę\" i \"Usuń\" — usunięcie chowa szafę z rzutu (lista 6 szaf jest stała w kodzie, więc to nie kasuje danych na trwałe). Nazwa zmienia się w jednym miejscu, widoczna wszędzie. Jeśli coś jest usunięte, w pasku na górze pojawia się chip \"Przywróć usunięte szafy\" — klik przywraca wszystkie naraz.",
            "Przycisk \"Zapisz układ\" zapisuje bieżące rozmieszczenie na stałe. Włączając w Ustawieniach \"Automatyczny zapis układu\" nie trzeba go klikać — zapis leci sam ok. 1,5s po ostatniej zmianie (widać to po chipie \"Auto-zapis\" w pasku); dotyczy też widoku szafy.",
        ],
    },
    {
        title: "Widok szafy (rack)",
        body: [
            "Wejdź w szafę dwuklikiem z rzutu głównego.",
            "Kliknij w nazwę szafy (\"Szafa 1\" itp.) w nagłówku, żeby ją zmienić — Enter lub kliknięcie poza polem zapisuje. Tę samą nazwę można też ustawić z rzutu głównego (prawy klik w szafę → \"Zmień nazwę\") — obie strony pokazują tę samą, wspólną nazwę.",
            "Ikonka ✎ edytuje slot: typ urządzenia, nazwa, wysokość (co 0,5U) i adres management.",
            "Ikonka kosza usuwa urządzenie ze slotu (zwalnia miejsce).",
            "Ikonka 🔗 otwiera adres management w nowej karcie (aktywna tylko gdy ustawiony).",
            "Ikonka ping wysyła realny ping na adres management i pokazuje wynik OK/BRAK.",
            "Panel po lewej to wizualny podgląd szafy (bez ikon temperatury/wilgotności przy urządzeniach — te dwie wartości są wspólne dla całej szafy, dostępne przez ikonki 🌡️/💧 na rzucie głównym, patrz sekcja \"Rzut serwerowni\").",
            "Na stronie historii temperatury/wilgotności są dwa niezależne poziomy progu: Non-Critical (ostrzeżenie) i Critical — każdy z własnym min/max, własnym alarmem i przyciskiem Symuluj/Potwierdź.",
            "Przełącznik \"Czujnik podłączony\" na górze tej strony wyłącza globalnie mock i alarmy temp./wilg. we wszystkich szafach naraz (jeden czujnik środowiskowy na szafę, nie na urządzenie) — przydatne, dopóki nie podłączysz realnych czujników.",
            "\"Opóźnienie alarmu\" — odczyt musi być poza progiem przez tyle sekund zanim alarm faktycznie się włączy (0 = natychmiast).",
            "Powrót odczytu w normę wysyła jednorazowy log/powiadomienie (jeśli włączone w regule) i sam gasi alarm — nie trzeba nic klikać.",
            "Pasek pod wartością pokazuje graficznie gdzie odczyt leży względem progów (czerwono-zielono-czerwono). Niżej: najniższy/najwyższy zanotowany odczyt z datą i przycisk \"Wyczyść rekordy\".",
            "Wykres ma przełącznik zakresu (Na żywo / 24h / tydzień / miesiąc) i przycisk \"Wyczyść wykres\" kasujący zapisaną historię tego slotu.",
        ],
    },
    {
        title: "Powiadomienia (Ustawienia)",
        body: [
            "W Ustawieniach → sekcja \"Powiadomienia\" tworzysz grupy odbiorców (nazwa + lista osób) — jedna grupa obsługuje oba kanały naraz, każdy odbiorca może mieć e-mail i/lub numer telefonu.",
            "Tabela reguł przypisuje jedną grupę do zdarzenia (pożar/gaz/zalanie/drzwi/próg temp.-wilg. szafy/napięcie zasilania) i osobno włącza kanał (e-mail/SMS) — oba kanały wysyłają do tych samych osób z tej grupy.",
            "\"Napięcie zasilania\" w menu bocznym pokazuje bieżącą wartość, pozwala ustawić progi min/max i ma własny przycisk testu/potwierdzania alarmu — tak samo jak inne czujniki. Przełącznik \"Czujnik podłączony\" wyłącza mock i alarmy, gdy nie masz podpiętego realnego czujnika napięcia — tak samo działa dla czujników temperatury/wilgotności w szafach (patrz sekcja \"Widok szafy\").",
            "Konfiguracja serwera SMTP (host/port/login/hasło/nadawca) jest w Ustawieniach → sekcja \"SMTP\" — nie w pliku .env. Jest tam też przycisk do wysłania testowego e-maila.",
            "Każda grupa ma własny harmonogram (\"Harmonogram wysyłki\") — siatka dzień×godzina określająca, kiedy powiadomienia faktycznie wychodzą (dotyczy obu kanałów naraz; alarm zawsze się loguje, niezależnie od harmonogramu).",
            "Reguła powiadomień może mieć własny temat e-maila (\"Własny temat e-mail\") i dołączać zdjęcie z kamery do wiadomości (\"Załącz zdjęcie z kamery\").",
            "Dwuklik w czujnik na rzucie (pożar/gaz/zalanie/drzwi) otwiera jego stronę z przyciskiem \"Symuluj alarm (test)\" — realnie wysyła powiadomienie do przypisanej grupy, żeby sprawdzić czy działa.",
            "Alarm nie znika ręcznym kasowaniem — gaśnie sam, dopiero gdy czujnik faktycznie wróci do normy. Przycisk \"Potwierdź alarm\" tylko wycisza kolejne maile/SMS-y (banner zmienia się na żółty \"Potwierdzony — czeka na powrót do normy\"), nie da się nim ukryć realnego zagrożenia.",
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
            "Potwierdzenie alarmu (patrz sekcja Powiadomienia) też zapisuje wpis w logu, wraz z nazwą użytkownika który to zrobił.",
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
