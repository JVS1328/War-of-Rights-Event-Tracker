import { Snowflake, CloudSun } from 'lucide-react';
import { MONTH_NAMES } from '../../utils/dateSystem';
import { getCardById } from '../data/starterCards';

const Calendar = ({ campaign }) => {
  const { month, year, winter, turnNumber, eventCardId } = campaign.turn;
  const eventCard = eventCardId ? getCardById('event', eventCardId) : null;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {winter ? <Snowflake className="w-5 h-5 text-blue-300" /> : <CloudSun className="w-5 h-5 text-amber-400" />}
          <span className="text-lg font-bold text-white">
            {MONTH_NAMES[month - 1]} {year}
          </span>
        </div>
        <span className="text-xs text-slate-400">Turn {turnNumber}</span>
      </div>
      {winter && (
        <div className="text-xs text-blue-300 italic mb-2">
          Winter: attackers take +{campaign.settings.winterAttritionPct}% casualties
        </div>
      )}
      {eventCard && (
        <div className="mt-2 bg-purple-900 bg-opacity-40 border border-purple-700 rounded p-2 text-xs">
          <div className="font-bold text-purple-300">Event: {eventCard.name}</div>
          <div className="text-slate-300 mt-1">{eventCard.text}</div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
