import { useNavigate } from "react-router-dom";
import Layout from "./Layout";
import {
    Box, Typography, IconButton, Accordion, AccordionSummary, AccordionDetails,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useLang } from "./translation";

export default function Help() {
    const navigate = useNavigate();
    const { t } = useLang();
    const SECTIONS = t("help_sections");
    return (
        <Layout>
            <Box sx={{ p: 2, maxWidth: 800, mx: "auto" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <IconButton size="small" onClick={() => navigate("/")}>
                        <ArrowBackIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="h5" fontWeight="bold" sx={{ color: "#1a1a2e" }}>
                        {t("nav_help")}
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
