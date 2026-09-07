"""Validate v1/v2 browser saves without resetting their local-calendar day."""

import math
import re
import time
from datetime import datetime

COUNTERS = ("xp", "stars", "wins", "training", "fed", "blocks", "pats")
SCENES = ("base", "moon", "sunset")
MONSTERS = ("obsidian", "lava", "cosmic")
MILESTONES = ("first_meal", "first_training", "first_guard", "first_victory", "training_routine", "starlight_rank", "new_horizons", "galaxy_guardian")
# ECMAScript String.trim() whitespace, matching the browser validator exactly.
NAME_WHITESPACE = "\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"


class ValidationError(ValueError):
    pass


def companion_name(value):
    if not isinstance(value, str) or any(ord(char) <= 0x1f or 0x7f <= ord(char) <= 0x9f or 0xd800 <= ord(char) <= 0xdfff for char in value):
        raise ValidationError("名字需要 1–12 个字，不能包含控制字符。")
    name = value.strip(NAME_WHITESPACE)
    if not 1 <= len(name) <= 12:
        raise ValidationError("名字需要 1–12 个字，不能包含控制字符。")
    return name


def number(value, name, minimum=0, maximum=10000000, integer=False):
    if (type(value) not in (int, float) or value < minimum or value > maximum
            or (type(value) is float and not math.isfinite(value))
            or (integer and value != math.floor(value))):
        raise ValidationError("存档字段 %s 不是有效数值。" % name)
    return int(value) if integer else value


def sanitize_state(raw):
    if not isinstance(raw, dict) or type(raw.get("version")) is not int:
        raise ValidationError("存档必须包含有效的 version。")
    if raw["version"] not in (1, 2):
        raise ValidationError("不支持此存档版本，请更新应用后重试。")
    now = int(time.time() * 1000)
    date = datetime.now().strftime("%Y-%m-%d")
    # JavaScript's dayKey deliberately omits month/day leading zeroes.
    date = "-".join(str(int(part)) for part in date.split("-"))
    state = {"version": 2, "companionName": companion_name(raw.get("companionName", "银河"))}
    milestones = raw.get("milestones", [])
    state["milestones"] = list(dict.fromkeys(item for item in milestones if isinstance(item, str) and item in MILESTONES)) if isinstance(milestones, list) else []
    for key in ("food", "energy", "mood"):
        state[key] = number(raw.get(key), key, maximum=100)
    for key in COUNTERS:
        state[key] = number(raw.get(key, 0), key, integer=True)
    for key in ("born", "updated"):
        value = number(raw.get(key, now), key, minimum=1, maximum=8640000000000000)
        state[key] = min(now, value)
    for key in ("sleeping", "grown", "sound"):
        state[key] = raw.get(key) is True
    state["difficulty"] = raw.get("difficulty") if raw.get("difficulty") in ("easy", "normal") else "normal"
    unlocked = raw.get("unlocked", [])
    unlocked = unlocked if isinstance(unlocked, list) else []
    state["unlocked"] = list(dict.fromkeys(["base"] + [x for x in unlocked if isinstance(x, str) and x in SCENES]))
    state["scene"] = raw.get("scene") if raw.get("scene") in state["unlocked"] else "base"
    defeated = raw.get("defeated", [])
    defeated = defeated if isinstance(defeated, list) else []
    state["defeated"] = list(dict.fromkeys(x for x in defeated if isinstance(x, str) and x in MONSTERS))
    daily = raw.get("daily") if isinstance(raw.get("daily"), dict) else {}
    day = daily.get("date")
    if isinstance(day, str) and re.fullmatch(r"\d{4}-\d{1,2}-\d{1,2}", day):
        try:
            datetime.strptime(day, "%Y-%m-%d")
            date = day
        except ValueError:
            pass
    state["daily"] = {"date": date, "claimed": daily.get("claimed") is True}
    for key in ("fed", "training", "battles"):
        state["daily"][key] = number(daily.get(key, 0), "daily." + key, integer=True)
    state["journal"] = []
    journal = raw.get("journal", [])
    if isinstance(journal, list):
        for entry in journal:
            if not isinstance(entry, dict) or not isinstance(entry.get("text"), str):
                continue
            at = entry.get("at")
            if type(at) not in (int, float) or (type(at) is float and not math.isfinite(at)):
                continue
            state["journal"].append({"text": entry["text"][:160], "at": min(now, max(0, at))})
            if len(state["journal"]) == 30:
                break
    return state
