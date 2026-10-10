from models import BetType, BetStatus

def resolve_bet(bet_criteria: dict, cv_results: dict, bet_type: str) -> tuple[BetStatus, float]:
    bet_type_val = bet_type.value if hasattr(bet_type, "value") else str(bet_type)
    
    if bet_type_val == BetType.COUNT_PREDICTION or bet_type_val == "count_prediction":
        target = bet_criteria.get("target_count")
        if target is None:
            target = bet_criteria.get("target")
        if target is None:
            target = bet_criteria.get("predicted_count")
        if target is None:
            target = bet_criteria.get("prediction")

        operator = bet_criteria.get("operator", "exact")
        
        # Check if duration window is defined (e.g., between 7s and 15s)
        duration_seconds = bet_criteria.get("duration_seconds")
        if duration_seconds is None:
            duration_seconds = bet_criteria.get("duration")

        actual = None
        if duration_seconds is not None:
            user_sec = float(duration_seconds)
            # 1. Check granular vehicle crossing timestamp events
            crossings = cv_results.get("crossings") or []
            if crossings:
                def _get_ts(c):
                    if isinstance(c, (int, float)):
                        return float(c)
                    if isinstance(c, dict):
                        return float(c.get("timestamp", c.get("t", c.get("time", 0.0))))
                    return 0.0
                actual = len([c for c in crossings if 0.0 <= _get_ts(c) <= user_sec])
            # 2. Or check per-second counts
            elif "counts_per_second" in cv_results and cv_results["counts_per_second"]:
                actual = sum(
                    int(s.get("count", 0))
                    for s in cv_results["counts_per_second"]
                    if float(s.get("second", s.get("t", 0))) <= user_sec
                )
            # 3. Or check pre-computed window_count
            elif "window_count" in cv_results and cv_results["window_count"] is not None:
                actual = cv_results.get("window_count")

        if actual is None:
            actual = cv_results.get("detected_count")

        if actual is None:
            return BetStatus.VOID, 0.0

        # Store validated window metrics back on cv_results for transparency
        cv_results["window_count"] = actual
        if duration_seconds is not None:
            cv_results["user_seconds"] = float(duration_seconds)

        won = False
        default_multiplier = 5.0 if operator == "exact" else 1.8
        multiplier = float(bet_criteria.get("multiplier", default_multiplier))

        if operator == "exact":
            won = (actual == target)
        elif operator == "over":
            won = (actual > target)
        elif operator == "under":
            won = (actual < target)
        else:
            return BetStatus.VOID, 0.0

        if won:
            return BetStatus.WON, multiplier
        else:
            return BetStatus.LOST, 0.0

    elif bet_type_val == BetType.TIME_PREDICTION or bet_type_val == "time_prediction":
        threshold_sec = bet_criteria.get("threshold_seconds")
        actual_duration = cv_results.get("green_light_duration")
        if actual_duration is not None and actual_duration >= threshold_sec:
             return BetStatus.WON, 2.0
        else:
             return BetStatus.LOST, 0.0

    return BetStatus.VOID, 0.0

