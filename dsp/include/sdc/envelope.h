#pragma once

namespace sdc
{
/** Linear-segment ADSR. Release ramps from wherever the envelope is, so letting go
    during the attack doesn't jump. */
class Envelope
{
public:
    enum class Stage { idle, attack, decay, sustain, release };

    void setSampleRate(double sr) { sampleRate = sr; }

    void setParameters(float attackSeconds, float decaySeconds, float sustainLevel, float releaseSeconds)
    {
        attack = attackSeconds;
        decay = decaySeconds;
        sustain = sustainLevel;
        release = releaseSeconds;
    }

    void noteOn()
    {
        stage = Stage::attack;
        level = 0.0f;
    }

    void noteOff()
    {
        if (stage == Stage::idle)
            return;
        stage = Stage::release;
        releaseStep = level / samples(release);
    }

    void reset()
    {
        stage = Stage::idle;
        level = 0.0f;
    }

    bool isActive() const { return stage != Stage::idle; }
    Stage getStage() const { return stage; }

    float next()
    {
        switch (stage)
        {
            case Stage::idle:
                break;
            case Stage::attack:
                level += 1.0f / samples(attack);
                if (level >= 1.0f)
                {
                    level = 1.0f;
                    stage = Stage::decay;
                }
                break;
            case Stage::decay:
                level -= (1.0f - sustain) / samples(decay);
                if (level <= sustain)
                {
                    level = sustain;
                    stage = Stage::sustain;
                }
                break;
            case Stage::sustain:
                level = sustain; // follows live sustain changes
                break;
            case Stage::release:
                level -= releaseStep;
                if (level <= 0.0f)
                    reset();
                break;
        }
        return level;
    }

private:
    float samples(float seconds) const
    {
        const float n = seconds * (float) sampleRate;
        return n < 1.0f ? 1.0f : n;
    }

    double sampleRate = 48000.0;
    float attack = 0.01f, decay = 0.1f, sustain = 0.8f, release = 0.3f;
    Stage stage = Stage::idle;
    float level = 0.0f;
    float releaseStep = 0.0f;
};
} // namespace sdc
