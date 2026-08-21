import { Stage, Layer, Group, Line, Rect, Text } from "react-konva";

export const DEVICE_TYPES = {
    server:   { label: "Serwer",      color: "#1e88e5" },
    switch:   { label: "Switch",      color: "#43a047" },
    router:   { label: "Router",      color: "#8e24aa" },
    patch:    { label: "Patch panel", color: "#546e7a" },
    ups:      { label: "UPS",         color: "#e53935" },
    firewall: { label: "Firewall",    color: "#f4511e" },
    empty:    { label: "Puste",       color: "#37474f" },
};

const ROW_H = 15;
const DEPTH = 12;

const C = {
    rackFace: "#0d1b28",
    rackTop:  "#1c2d3e",
    rackSide: "#0a1520",
    rackBdr:  "#2a5a80",
    unitLine: "#0a1520",
    textBr:   "#7abcd8",
};

function pts(arr) { return arr.flatMap(p => [p.x, p.y]); }

export default function RackVisual3D({ slots, rackSize, rackLabel, width = 190, onUnitClick }) {
    const bodyH = rackSize * ROW_H;
    const stageW = width + DEPTH + 4;
    const stageH = bodyH + DEPTH + 30;
    const ox = 2, oy = DEPTH + 20;

    const fl  = { x: ox,             y: oy };
    const fr  = { x: ox + width,     y: oy };
    const bl  = { x: ox + DEPTH,     y: oy - DEPTH };
    const br  = { x: ox + width + DEPTH, y: oy - DEPTH };
    const flB = { x: ox,             y: oy + bodyH };
    const frB = { x: ox + width,     y: oy + bodyH };
    const brB = { x: ox + width + DEPTH, y: oy + bodyH - DEPTH };

    return (
        <Stage width={stageW} height={stageH}>
            <Layer>
                {/* Top face */}
                <Line closed points={pts([fl, fr, br, bl])} fill={C.rackTop} stroke={C.rackBdr} strokeWidth={1} />
                {/* Side face */}
                <Line closed points={pts([fr, br, brB, frB])} fill={C.rackSide} stroke={C.rackBdr} strokeWidth={1} />
                {/* Front face */}
                <Rect x={fl.x} y={fl.y} width={width} height={bodyH} fill={C.rackFace} stroke={C.rackBdr} strokeWidth={1.5} />

                {/* Units */}
                {slots.map(slot => {
                    const dtype   = DEVICE_TYPES[slot.type] || DEVICE_TYPES.empty;
                    const isEmpty = slot.type === "empty";
                    const h       = (slot.height || 1) * ROW_H;
                    const y       = fl.y + (slot.unit - 1) * ROW_H;
                    return (
                        <Group key={slot.unit}>
                            <Rect x={fl.x + 1} y={y} width={width - 2} height={h}
                                fill={isEmpty ? "transparent" : dtype.color}
                                opacity={isEmpty ? 1 : 0.85} />
                            <Line points={[fl.x, y, fl.x + width, y]} stroke={C.unitLine} strokeWidth={0.5} />
                            {!isEmpty && (
                                <>
                                    <Group
                                        onClick={() => onUnitClick && onUnitClick(slot.unit, "temperature")}
                                        onTap={() => onUnitClick && onUnitClick(slot.unit, "temperature")}
                                    >
                                        <Text text="🌡️" x={fl.x + width - 34} y={y + h / 2 - 7}
                                            width={16} align="center" fontSize={11} />
                                    </Group>
                                    <Group
                                        onClick={() => onUnitClick && onUnitClick(slot.unit, "humidity")}
                                        onTap={() => onUnitClick && onUnitClick(slot.unit, "humidity")}
                                    >
                                        <Text text="💧" x={fl.x + width - 18} y={y + h / 2 - 7}
                                            width={16} align="center" fontSize={11} />
                                    </Group>
                                </>
                            )}
                        </Group>
                    );
                })}
                <Line points={[fl.x, flB.y, fl.x + width, flB.y]} stroke={C.rackBdr} strokeWidth={1} />

                {/* Label */}
                <Text text={rackLabel} x={fl.x} y={oy - DEPTH - 16}
                    width={width} align="center" fontSize={12} fill={C.textBr} fontStyle="bold" />
            </Layer>
        </Stage>
    );
}
