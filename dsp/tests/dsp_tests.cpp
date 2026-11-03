// Native tests for the DSP core (synth, wet channel and micro-loop). They run on every push (see .github/workflows/ci.yml)
// before the same code is compiled to WebAssembly.

#include <cmath>
#include <cstdio>
#include <functional>
#include <memory>
#include <string>
#include <vector>

#include "sdc/synth.h"

namespace
{
struct TestCase
{
    const char* name;
    std::function<void()> run;
};

std::vector<TestCase>& registry()
{
    static std::vector<TestCase> tests;
    return tests;
}

struct Register
{
    Register(const char* name, std::function<void()> fn) { registry().push_back({ name, std::move(fn) }); }
};

int failures = 0;

void check(bool condition, const char* expr, const char* file, int line)
{
    if (!condition)
    {
        ++failures;
        std::printf("    FAILED: %s (%s:%d)\n", expr, file, line);
    }
}

#define TEST(name) \
    static void name(); \
    static Register reg_##name(#name, name); \
    static void name()
#define CHECK(expr) check((expr), #expr, __FILE__, __LINE__)

constexpr double sampleRate = 48000.0;

float rms(const std::vector<float>& x, size_t from = 0)
{
    double sum = 0.0;
    for (size_t i = from; i < x.size(); ++i)
        sum += (double) x[i] * x[i];
    return (float) std::sqrt(sum / (double) (x.size() - from));
}

bool allFinite(const std::vector<float>& x)
{
    for (float v : x)
        if (!std::isfinite(v))
            return false;
    return true;
}

std::unique_ptr<sdc::Synth> makeSynth()
{
    auto s = std::make_unique<sdc::Synth>();
    s->setSampleRate(sampleRate);
    // Defaults already leave the wet channel and the micro-loop off, so tests hear the dry synth.
    return s;
}

std::vector<float> render(sdc::Synth& s, int frames, std::vector<float>* right = nullptr)
{
    std::vector<float> l((size_t) frames), r((size_t) frames);
    s.process(l.data(), r.data(), frames);
    if (right != nullptr)
        *right = r;
    return l;
}
} // namespace

// ---------------------------------------------------------------- oscillators

TEST(oscillators_stay_bounded_across_the_keyboard)
{
    sdc::CustomWave custom;
    for (int w = 0; w <= 4; ++w)
    {
        for (double hz : { 20.0, 440.0, 4000.0, 15000.0 })
        {
            sdc::Oscillator osc;
            float peak = 0.0f;
            for (int i = 0; i < 48000; ++i)
                peak = std::fmax(peak, std::fabs(osc.next((sdc::Wave) w, hz / sampleRate, custom)));
            CHECK(peak <= 1.3f); // PolyBLEP can overshoot a little, never blow up
            if (hz <= 4000.0) // above that a cycle is only a few samples long
                CHECK(peak > 0.5f);
        }
    }
}

TEST(saw_has_no_dc_offset)
{
    sdc::CustomWave custom;
    sdc::Oscillator osc;
    double sum = 0.0;
    const int n = 48000;
    for (int i = 0; i < n; ++i)
        sum += osc.next(sdc::Wave::saw, 100.0 / sampleRate, custom);
    CHECK(std::fabs(sum / n) < 0.01);
}

// ---------------------------------------------------------------- custom wave

TEST(custom_wave_starts_as_a_sine)
{
    sdc::CustomWave wave;
    CHECK(std::fabs(wave.sampleAt(0.25f) - 1.0f) < 0.05f);
    CHECK(std::fabs(wave.sampleAt(0.75f) + 1.0f) < 0.05f);
    CHECK(std::fabs(wave.sampleAt(0.0f)) < 0.05f);
}

TEST(custom_wave_points_keep_their_order)
{
    sdc::CustomWave wave;
    wave.setPoint(3, { 0.9f, 2.0f }); // past its right neighbour, and out of range
    const auto p = wave.getPoint(3);
    CHECK(p.x < wave.getPoint(4).x);
    CHECK(p.y == 1.0f);

    wave.setPoint(0, { 0.5f, 0.3f }); // the first point is pinned to the start of the cycle
    CHECK(wave.getPoint(0).x == 0.0f);
}

TEST(custom_wave_follows_its_points)
{
    sdc::CustomWave wave;
    for (int i = 0; i < sdc::CustomWave::numPoints; ++i)
        wave.setPoint(i, { wave.getPoint(i).x, 0.5f }); // flat line
    for (float phase = 0.0f; phase < 1.0f; phase += 0.05f)
        CHECK(std::fabs(wave.sampleAt(phase) - 0.5f) < 1.0e-4f);
}

// ---------------------------------------------------------------- envelope

TEST(envelope_reaches_full_level_after_attack_then_sustain)
{
    sdc::Envelope env;
    env.setSampleRate(sampleRate);
    env.setParameters(0.01f, 0.1f, 0.5f, 0.2f);
    env.noteOn();

    float level = 0.0f;
    for (int i = 0; i < (int) (0.01 * sampleRate); ++i)
        level = env.next();
    CHECK(level > 0.99f);

    for (int i = 0; i < (int) (0.2 * sampleRate); ++i)
        level = env.next();
    CHECK(std::fabs(level - 0.5f) < 1.0e-4f);
}

TEST(envelope_release_finishes_on_time)
{
    sdc::Envelope env;
    env.setSampleRate(sampleRate);
    env.setParameters(0.001f, 0.001f, 1.0f, 0.1f);
    env.noteOn();
    for (int i = 0; i < 1000; ++i)
        env.next();
    env.noteOff();
    for (int i = 0; i < (int) (0.1 * sampleRate) + 2; ++i)
        env.next();
    CHECK(!env.isActive());
}

// ---------------------------------------------------------------- filter

TEST(filter_passes_lows_and_cuts_highs)
{
    const auto runSine = [](float hz) {
        sdc::LowPassFilter f;
        f.setSampleRate(sampleRate);
        std::vector<float> out(48000);
        for (size_t i = 0; i < out.size(); ++i)
            out[i] = f.process(std::sin(sdc::twoPi * hz * (float) i / (float) sampleRate), 500.0f, 0.707f);
        return rms(out, 4800);
    };
    const float sineRms = 0.7071f;
    CHECK(runSine(100.0f) > 0.9f * sineRms);
    CHECK(runSine(8000.0f) < 0.02f * sineRms);
}

TEST(filter_stays_stable_at_extreme_settings)
{
    sdc::LowPassFilter f;
    f.setSampleRate(sampleRate);
    std::vector<float> out(48000);
    for (size_t i = 0; i < out.size(); ++i)
    {
        const float cutoff = (i / 100) % 2 == 0 ? 20.0f : 30000.0f; // slams between extremes
        out[i] = f.process((i % 50) < 25 ? 1.0f : -1.0f, cutoff, 10.0f);
    }
    CHECK(allFinite(out));
}

// ---------------------------------------------------------------- synth

TEST(synth_is_silent_until_a_note_plays)
{
    auto s = makeSynth();
    CHECK(rms(render(*s, 4800)) == 0.0f);
    s->noteOn(60, 1.0f);
    CHECK(rms(render(*s, 4800)) > 0.01f);
}

TEST(synth_goes_quiet_after_release)
{
    auto s = makeSynth();
    s->setParam(sdc::Param::release, 0.05f);
    s->noteOn(60, 1.0f);
    render(*s, 4800);
    s->noteOff(60);
    render(*s, (int) (0.1 * sampleRate));
    CHECK(s->activeVoiceCount() == 0);
    CHECK(rms(render(*s, 4800)) < 1.0e-4f);
}

TEST(synth_steals_the_oldest_voice_when_full)
{
    auto s = makeSynth();
    for (int n = 0; n < sdc::Synth::numVoices + 3; ++n)
        s->noteOn(48 + n, 0.8f);
    CHECK(s->activeVoiceCount() == sdc::Synth::numVoices);
    std::vector<float> out = render(*s, 4800);
    CHECK(allFinite(out));
}

TEST(repeating_a_note_reuses_its_voice)
{
    auto s = makeSynth();
    s->noteOn(60, 1.0f);
    s->noteOn(60, 1.0f);
    CHECK(s->activeVoiceCount() == 1);
}

TEST(output_never_exceeds_full_scale)
{
    auto s = makeSynth();
    s->setParam(sdc::Param::volume, 6.0f);
    s->setParam(sdc::Param::osc2Level, 1.0f);
    s->setParam(sdc::Param::resonance, 10.0f);
    s->setParam(sdc::Param::wetMode, 1.0f); // delay
    s->setParam(sdc::Param::wetMix, 1.0f);
    s->setParam(sdc::Param::wetModify, 1.0f); // maximum feedback
    s->setParam(sdc::Param::autoGlitch, 1.0f);
    s->setParam(sdc::Param::glitchMix, 1.0f);
    s->setParam(sdc::Param::glitchDegrade, 1.0f);
    for (int n = 0; n < 8; ++n)
        s->noteOn(36 + n * 3, 1.0f);
    std::vector<float> r;
    std::vector<float> l = render(*s, 48000 * 3, &r);
    CHECK(allFinite(l) && allFinite(r));
    float peak = 0.0f;
    for (size_t i = 0; i < l.size(); ++i)
        peak = std::fmax(peak, std::fmax(std::fabs(l[i]), std::fabs(r[i])));
    CHECK(peak <= 1.0f);
}

// ---------------------------------------------------------------- wet

/** Plays a short note, waits until the dry sound is gone, then returns the RMS of what's left. */
float tailAfterShortNote(sdc::Synth& s)
{
    s.setParam(sdc::Param::release, 0.01f);
    s.noteOn(60, 1.0f);
    render(s, 2400);
    s.noteOff(60);
    render(s, 4800); // the dry note is over by now
    return rms(render(s, 24000));
}

TEST(wet_is_off_by_default)
{
    auto s = makeSynth();
    CHECK(tailAfterShortNote(*s) < 1.0e-5f);
}

TEST(reverb_leaves_a_tail)
{
    auto s = makeSynth();
    s->setParam(sdc::Param::wetMode, 0.0f);
    s->setParam(sdc::Param::wetMix, 0.6f);
    s->setParam(sdc::Param::wetTime, 0.9f);
    CHECK(tailAfterShortNote(*s) > 0.001f);
}

TEST(delay_repeats_after_the_note)
{
    auto s = makeSynth();
    s->setParam(sdc::Param::wetMode, 1.0f);
    s->setParam(sdc::Param::wetMix, 0.6f);
    s->setParam(sdc::Param::wetTime, 0.5f);   // ~200 ms
    s->setParam(sdc::Param::wetModify, 0.6f); // feedback
    CHECK(tailAfterShortNote(*s) > 0.001f);
}

TEST(slip_mode_stays_stable_at_every_speed)
{
    for (float modify : { 0.1f, 0.4f, 0.6f, 0.9f }) // reverse, half, reverse octave-up, octave-up
    {
        auto s = makeSynth();
        s->setParam(sdc::Param::wetMode, 2.0f);
        s->setParam(sdc::Param::wetMix, 1.0f);
        s->setParam(sdc::Param::wetModify, modify);
        s->noteOn(60, 1.0f);
        std::vector<float> out = render(*s, 48000);
        CHECK(allFinite(out));
        CHECK(rms(out) > 0.001f);
    }
}

// ---------------------------------------------------------------- micro-loop

TEST(micro_loop_only_runs_with_auto_glitch_on)
{
    auto s = makeSynth();
    s->setParam(sdc::Param::glitchMix, 1.0f);
    s->noteOn(60, 1.0f);
    render(*s, 24000);
    CHECK(!s->isLooping());

    s->setParam(sdc::Param::autoGlitch, 1.0f);
    render(*s, 24000);
    CHECK(s->isLooping());
}

TEST(kept_loop_keeps_sounding_after_the_note_ends)
{
    auto s = makeSynth();
    s->setParam(sdc::Param::autoGlitch, 1.0f);
    s->setParam(sdc::Param::glitchMix, 1.0f);
    s->setParam(sdc::Param::glitchHold, 1.0f);
    s->setParam(sdc::Param::loopKeep, 1.0f);
    CHECK(tailAfterShortNote(*s) > 0.001f);
    CHECK(s->isLooping());
}

TEST(loop_fades_out_with_the_input_unless_kept)
{
    auto s = makeSynth();
    s->setParam(sdc::Param::autoGlitch, 1.0f);
    s->setParam(sdc::Param::glitchMix, 1.0f);
    s->setParam(sdc::Param::glitchHold, 1.0f);
    s->setParam(sdc::Param::release, 0.01f);
    s->noteOn(60, 1.0f);
    render(*s, 24000);
    s->noteOff(60);
    render(*s, 48000); // gate closes ~0.25 s after the input goes quiet
    CHECK(rms(render(*s, 4800)) < 1.0e-4f);
}

TEST(micro_loop_survives_extreme_settings)
{
    auto s = makeSynth();
    s->setParam(sdc::Param::autoGlitch, 1.0f);
    s->setParam(sdc::Param::glitchMix, 1.0f);
    s->setParam(sdc::Param::glitchGrainSize, 20.0f);
    s->setParam(sdc::Param::loopInterval, 9.0f); // +2 octaves
    s->setParam(sdc::Param::loopJumps, 1.0f);
    s->setParam(sdc::Param::glitchChaos, 1.0f);
    s->setParam(sdc::Param::glitchReverse, 1.0f);
    s->setParam(sdc::Param::glitchDegrade, 1.0f);
    for (int k = 0; k < 20; ++k) // staccato notes keep grabbing fresh grains
    {
        s->noteOn(48 + k, 1.0f);
        CHECK(allFinite(render(*s, 2000)));
        s->noteOff(48 + k);
        CHECK(allFinite(render(*s, 1000)));
    }
}

TEST(params_are_clamped_and_nan_is_ignored)
{
    auto s = makeSynth();
    s->setParam(sdc::Param::cutoff, 1.0e9f);
    CHECK(s->getParam(sdc::Param::cutoff) == sdc::paramInfo[(int) sdc::Param::cutoff].max);
    s->setParam(sdc::Param::cutoff, std::nanf(""));
    CHECK(s->getParam(sdc::Param::cutoff) == sdc::paramInfo[(int) sdc::Param::cutoff].max);
    s->setParam((sdc::Param) 999, 1.0f); // unknown id: no crash
}

TEST(lfo_on_volume_never_boosts)
{
    auto plain = makeSynth();
    auto tremolo = makeSynth();
    tremolo->setParam(sdc::Param::lfoTarget, 2.0f);
    tremolo->setParam(sdc::Param::lfoDepth, 1.0f);
    plain->noteOn(57, 1.0f);
    tremolo->noteOn(57, 1.0f);
    CHECK(rms(render(*tremolo, 48000)) < rms(render(*plain, 48000)));
}

int main()
{
    int passed = 0;
    for (const auto& test : registry())
    {
        const int before = failures;
        test.run();
        const bool ok = failures == before;
        passed += ok ? 1 : 0;
        std::printf("%s %s\n", ok ? "  ok  " : " FAIL ", test.name);
    }
    std::printf("\n%d/%d tests passed\n", passed, (int) registry().size());
    return failures == 0 ? 0 : 1;
}
