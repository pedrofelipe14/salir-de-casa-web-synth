#pragma once

#include <array>
#include <cmath>

namespace sdc
{
/** A single-cycle waveform shaped by a few points. A Catmull-Rom curve runs through
    them (wrapping from the last back to the first) and is rendered to a table the
    oscillator reads from. Same model as the Salir de Casa VST3. */
class CustomWave
{
public:
    static constexpr int numPoints = 8;
    static constexpr int tableSize = 256;

    struct Point
    {
        float x = 0.0f; // position in the cycle, 0..1 (point 0 is pinned to 0)
        float y = 0.0f; // level, -1..1
    };

    CustomWave() { reset(); }

    /** Evenly spaced points tracing a sine. */
    void reset()
    {
        for (int i = 0; i < numPoints; ++i)
        {
            const float x = (float) i / (float) numPoints;
            points[(size_t) i] = { x, std::sin(6.28318530717958647692f * x) };
        }
        renderTable();
    }

    Point getPoint(int index) const { return points[(size_t) index]; }

    /** Moves a point, keeping it between its neighbours. */
    void setPoint(int index, Point point)
    {
        if (index < 0 || index >= numPoints)
            return;

        constexpr float minGap = 0.02f;
        const float lowX  = index == 0 ? 0.0f : points[(size_t) index - 1].x + minGap;
        const float highX = index == numPoints - 1 ? 1.0f - minGap : points[(size_t) index + 1].x - minGap;

        point.x = index == 0 ? 0.0f : clamp(point.x, lowX, highX);
        point.y = clamp(point.y, -1.0f, 1.0f);
        points[(size_t) index] = point;
        renderTable();
    }

    /** Linearly interpolated table read, phase in [0, 1). */
    float sampleAt(float phase) const
    {
        const float position = phase * (float) tableSize;
        int i0 = (int) position;
        i0 = i0 < 0 ? 0 : (i0 >= tableSize ? tableSize - 1 : i0);
        const int i1 = (i0 + 1) % tableSize;
        const float frac = position - (float) i0;
        return table[(size_t) i0] + frac * (table[(size_t) i1] - table[(size_t) i0]);
    }

private:
    static float clamp(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }

    float curveAt(float phase) const
    {
        int segment = numPoints - 1;
        for (int i = 0; i < numPoints - 1; ++i)
        {
            if (phase < points[(size_t) i + 1].x)
            {
                segment = i;
                break;
            }
        }

        const auto pointAt = [this](int i) { return points[(size_t) ((i + numPoints) % numPoints)]; };
        const float startX = points[(size_t) segment].x;
        const float endX = segment == numPoints - 1 ? 1.0f : points[(size_t) segment + 1].x;
        const float span = endX - startX;
        const float t = (phase - startX) / (span > 1.0e-6f ? span : 1.0e-6f);

        const float y0 = pointAt(segment - 1).y;
        const float y1 = pointAt(segment).y;
        const float y2 = pointAt(segment + 1).y;
        const float y3 = pointAt(segment + 2).y;

        const float value = 0.5f * ((2.0f * y1)
                                    + (-y0 + y2) * t
                                    + (2.0f * y0 - 5.0f * y1 + 4.0f * y2 - y3) * t * t
                                    + (-y0 + 3.0f * y1 - 3.0f * y2 + y3) * t * t * t);
        return clamp(value, -1.0f, 1.0f);
    }

    void renderTable()
    {
        for (int i = 0; i < tableSize; ++i)
            table[(size_t) i] = curveAt((float) i / (float) tableSize);
    }

    std::array<Point, numPoints> points {};
    std::array<float, tableSize> table {};
};
} // namespace sdc
