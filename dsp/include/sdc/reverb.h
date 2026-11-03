#pragma once

#include <algorithm>
#include <vector>

namespace sdc
{
/** Freeverb (Jezar at Dreampoint): 8 damped combs into 4 all-passes per side, with the
    right side's delays spread a little longer. The same algorithm and scaling as
    juce::Reverb, which the VST3's wet reverb uses, so the two sound alike. */
class Reverb
{
public:
    void setSampleRate(double sr)
    {
        static constexpr int combTunings[numCombs] = { 1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617 };
        static constexpr int allPassTunings[numAllPasses] = { 556, 441, 341, 225 };
        static constexpr int stereoSpread = 23;

        const double scale = sr / 44100.0;
        for (int side = 0; side < 2; ++side)
        {
            const int spread = side == 1 ? stereoSpread : 0;
            for (int i = 0; i < numCombs; ++i)
                combs[side][i].resize((size_t) ((combTunings[i] + spread) * scale));
            for (int i = 0; i < numAllPasses; ++i)
                allPasses[side][i].resize((size_t) ((allPassTunings[i] + spread) * scale));
        }
    }

    /** roomSize and damping 0..1. Fully wet, full width (how the VST3 sets it). */
    void setParameters(float roomSize, float damping)
    {
        feedback = roomSize * 0.28f + 0.7f;
        damp = damping * 0.4f;
    }

    void reset()
    {
        for (auto& side : combs)
            for (auto& c : side)
                c.clear();
        for (auto& side : allPasses)
            for (auto& a : side)
                a.clear();
    }

    void process(float* left, float* right, int numSamples)
    {
        constexpr float inputGain = 0.015f;
        constexpr float wetGain = 3.0f; // 0.5 * wetScaleFactor (3) * (1 + width (1))

        for (int i = 0; i < numSamples; ++i)
        {
            const float input = (left[i] + right[i]) * inputGain;
            float outL = 0.0f, outR = 0.0f;
            for (int c = 0; c < numCombs; ++c)
            {
                outL += combs[0][c].process(input, damp, feedback);
                outR += combs[1][c].process(input, damp, feedback);
            }
            for (int a = 0; a < numAllPasses; ++a)
            {
                outL = allPasses[0][a].process(outL);
                outR = allPasses[1][a].process(outR);
            }
            left[i] = outL * wetGain;
            right[i] = outR * wetGain;
        }
    }

private:
    static constexpr int numCombs = 8;
    static constexpr int numAllPasses = 4;

    struct Comb
    {
        std::vector<float> buffer;
        size_t index = 0;
        float last = 0.0f;

        void resize(size_t size) { buffer.assign(size < 1 ? 1 : size, 0.0f); index = 0; last = 0.0f; }
        void clear() { std::fill(buffer.begin(), buffer.end(), 0.0f); last = 0.0f; }

        float process(float input, float dampAmount, float feedbackLevel)
        {
            const float output = buffer[index];
            last = output * (1.0f - dampAmount) + last * dampAmount;
            buffer[index] = input + last * feedbackLevel;
            if (++index >= buffer.size())
                index = 0;
            return output;
        }
    };

    struct AllPass
    {
        std::vector<float> buffer;
        size_t index = 0;

        void resize(size_t size) { buffer.assign(size < 1 ? 1 : size, 0.0f); index = 0; }
        void clear() { std::fill(buffer.begin(), buffer.end(), 0.0f); }

        float process(float input)
        {
            const float buffered = buffer[index];
            buffer[index] = input + buffered * 0.5f;
            if (++index >= buffer.size())
                index = 0;
            return buffered - input;
        }
    };

    Comb combs[2][numCombs];
    AllPass allPasses[2][numAllPasses];
    float feedback = 0.84f;
    float damp = 0.2f;
};
} // namespace sdc
