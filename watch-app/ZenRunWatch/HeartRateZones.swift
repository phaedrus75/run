/**
 * HeartRateZones
 * --------------
 * Five-zone heart-rate model expressed as a fraction of a user's max HR.
 *
 * Build 33 ships with a sensible default max HR (190 BPM) for new users; build
 * 34 will let the user override it from the iPhone profile screen and sync
 * the value to the watch via WCSession applicationContext. Until then, the
 * default is roughly representative of a healthy 30 y/o (220 - 30 = 190) and
 * keeps the colors meaningful for typical training intensities.
 *
 * Zone definitions follow the canonical "Karvonen / %HRmax" intensity ladder:
 *
 *   Z1  Recovery  50–60 %  Active rest, easy walking
 *   Z2  Aerobic   60–70 %  Long-slow-distance, fat-burn
 *   Z3  Tempo     70–80 %  Steady-state, cardio improvement
 *   Z4  Threshold 80–90 %  Lactate threshold, hard effort
 *   Z5  VO₂ Max   90–100%+ Sprint / max effort
 */

import Foundation
import SwiftUI

enum HRZone: Int, CaseIterable, Codable {
    case recovery  = 1
    case aerobic   = 2
    case tempo     = 3
    case threshold = 4
    case vo2max    = 5

    /// Lower bound (inclusive) as a fraction of max HR.
    var lowerFraction: Double {
        switch self {
        case .recovery:  return 0.50
        case .aerobic:   return 0.60
        case .tempo:     return 0.70
        case .threshold: return 0.80
        case .vo2max:    return 0.90
        }
    }

    /// Upper bound (exclusive) as a fraction of max HR.
    var upperFraction: Double {
        switch self {
        case .recovery:  return 0.60
        case .aerobic:   return 0.70
        case .tempo:     return 0.80
        case .threshold: return 0.90
        case .vo2max:    return 1.20  // intentionally generous for spikes
        }
    }

    var label: String {
        switch self {
        case .recovery:  return "Recovery"
        case .aerobic:   return "Aerobic"
        case .tempo:     return "Tempo"
        case .threshold: return "Threshold"
        case .vo2max:    return "VO₂ Max"
        }
    }

    /// Short label for tight UI contexts (zone bars, etc.).
    var shortLabel: String { "Z\(rawValue)" }

    /// Color used to tint the live HR display when in this zone.
    /// Picked to read at a glance on watchOS — saturated greens/yellows for
    /// easier zones, deep oranges/reds for hard ones. Designed to work over
    /// both light and dark backgrounds.
    var color: Color {
        switch self {
        case .recovery:  return Color(red: 0.45, green: 0.70, blue: 0.95) // soft blue
        case .aerobic:   return Color(red: 0.30, green: 0.78, blue: 0.55) // green
        case .tempo:     return Color(red: 0.95, green: 0.78, blue: 0.32) // amber
        case .threshold: return Color(red: 0.95, green: 0.51, blue: 0.18) // orange
        case .vo2max:    return Color(red: 0.92, green: 0.27, blue: 0.27) // red
        }
    }
}

struct HeartRateZones {
    /// Default max HR until the user supplies their own.
    static let defaultMaxHR: Double = 190.0

    /// Returns the zone for a given heart rate at a given max-HR setting, or
    /// nil if the HR is implausibly low (< 40 BPM — almost certainly a sensor
    /// glitch the moment a workout starts).
    static func zone(for hr: Double, maxHR: Double = defaultMaxHR) -> HRZone? {
        guard hr >= 40, maxHR > 0 else { return nil }
        let fraction = hr / maxHR
        for zone in HRZone.allCases.reversed() {
            if fraction >= zone.lowerFraction { return zone }
        }
        return nil
    }
}
