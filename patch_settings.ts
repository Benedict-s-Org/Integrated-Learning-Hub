import { readFileSync, writeFileSync } from 'fs';

const file = 'src/pages/InteractiveScanQuizPage.tsx';
let content = readFileSync(file, 'utf-8');

const oldDefaults = `                            <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                                <span>Reward Tiers</span>
                                <span className="text-slate-800">1st: 30, 2nd: 20, 3rd: 10, Part: 5</span>
                            </div>
                            <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                                <span>Sound Effects</span>
                                <span className="text-slate-800">Enabled</span>
                            </div>`;

const newDefaults = `                            <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                                <span>Reward Tiers</span>
                                <span className="text-slate-800">1st: {rewardTiers.first}, 2nd: {rewardTiers.second}, 3rd: {rewardTiers.third}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                                <span>Sound Effects</span>
                                <span className="text-slate-800">{soundEnabled ? 'Enabled' : 'Disabled'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm font-medium text-slate-600">
                                <span>Scan Timer</span>
                                <span className="text-slate-800">{timerSeconds}s</span>
                            </div>`;

content = content.replace(oldDefaults, newDefaults);

writeFileSync(file, content);
