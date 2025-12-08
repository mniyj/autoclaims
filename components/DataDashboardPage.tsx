
import React, { useState, useMemo } from 'react';
import { MOCK_END_USERS } from '../constants';

// Helper for SVG Chart
const TrendChart: React.FC<{ 
    data: { date: string; users: number; members: number }[]; 
}> = ({ data }) => {
    if (data.length === 0) return <div className="h-64 flex items-center justify-center text-gray-400">暂无数据</div>;

    const width = 800;
    const height = 300;
    const padding = { top: 40, right: 60, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate Max Values for Scaling
    const maxUsers = Math.max(...data.map(d => d.users), 1);
    const maxMembers = Math.max(...data.map(d => d.members), 1);
    
    // Add some headroom (20%)
    const y1Max = Math.ceil(maxUsers * 1.2);
    const y2Max = Math.ceil(maxMembers * 1.2);

    const barWidth = Math.min(40, (chartWidth / data.length) * 0.5);

    // Helpers to calculate coordinates
    const getX = (index: number) => padding.left + (index * (chartWidth / data.length)) + (chartWidth / data.length) / 2;
    const getY1 = (val: number) => padding.top + chartHeight - (val / y1Max) * chartHeight;
    const getY2 = (val: number) => padding.top + chartHeight - (val / y2Max) * chartHeight;

    // Generate Path for Line Chart
    const linePath = data.map((d, i) => 
        `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY2(d.members)}`
    ).join(' ');

    return (
        <div className="w-full overflow-x-auto">
            <div className="min-w-[600px]">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                    {/* Grid Lines (based on Y1/Users) */}
                    {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
                        const y = padding.top + chartHeight - (chartHeight * tick);
                        return (
                            <g key={tick}>
                                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e5e7eb" strokeDasharray="4 4" />
                                {/* Left Axis Labels (Users) */}
                                <text x={padding.left - 10} y={y + 4} textAnchor="end" className="text-xs fill-gray-500 font-medium">
                                    {Math.round(y1Max * tick)}
                                </text>
                                {/* Right Axis Labels (Members) */}
                                <text x={width - padding.right + 10} y={y + 4} textAnchor="start" className="text-xs fill-gray-500 font-medium">
                                    {Math.round(y2Max * tick)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Bars (Users) */}
                    {data.map((d, i) => {
                        const x = getX(i) - barWidth / 2;
                        const y = getY1(d.users);
                        const h = chartHeight - (y - padding.top);
                        return (
                            <g key={`bar-${i}`} className="group">
                                <rect 
                                    x={x} 
                                    y={y} 
                                    width={barWidth} 
                                    height={h} 
                                    fill="#3b82f6" 
                                    rx="4"
                                    className="opacity-80 hover:opacity-100 transition-opacity"
                                />
                                {/* Tooltip - User Count */}
                                <text x={getX(i)} y={y - 8} textAnchor="middle" className="text-[10px] fill-blue-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                    {d.users}
                                </text>
                            </g>
                        );
                    })}

                    {/* Line (Family Members) */}
                    <path d={linePath} fill="none" stroke="#f97316" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    
                    {/* Dots (Family Members) */}
                    {data.map((d, i) => (
                        <g key={`dot-${i}`} className="group">
                            <circle 
                                cx={getX(i)} 
                                cy={getY2(d.members)} 
                                r="4" 
                                fill="white" 
                                stroke="#f97316" 
                                strokeWidth="2" 
                                className="hover:scale-125 transition-transform"
                            />
                             {/* Tooltip - Member Count */}
                             <text x={getX(i)} y={getY2(d.members) - 10} textAnchor="middle" className="text-[10px] fill-orange-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                    {d.members}
                            </text>
                        </g>
                    ))}

                    {/* X Axis Labels */}
                    {data.map((d, i) => (
                        <text key={`label-${i}`} x={getX(i)} y={height - 10} textAnchor="middle" className="text-xs fill-gray-600">
                            {d.date.slice(5)} {/* Show MM-DD */}
                        </text>
                    ))}

                    {/* Axis Titles */}
                    <text x={10} y={padding.top - 10} className="text-xs font-bold fill-blue-600">用户数 (人)</text>
                    <text x={width - 80} y={padding.top - 10} className="text-xs font-bold fill-orange-600">家庭覆盖 (人)</text>
                </svg>
            </div>
            {/* Legend */}
            <div className="flex justify-center items-center space-x-6 mt-2 text-sm">
                <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
                    <span className="text-gray-600">新增用户数 (柱状图)</span>
                </div>
                <div className="flex items-center">
                    <div className="w-3 h-1 bg-orange-500 rounded mr-2 border-b-2 border-orange-500"></div>
                     <span className="text-gray-600">覆盖家庭成员数 (折线图)</span>
                </div>
            </div>
        </div>
    );
};

const DataDashboardPage: React.FC = () => {
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [selectedChannel, setSelectedChannel] = useState('');

    const channels = useMemo(() => Array.from(new Set(MOCK_END_USERS.map(u => u.channel))), []);

    const filteredData = useMemo(() => {
        return MOCK_END_USERS.filter(user => {
            const userDate = user.submissionTime.split(' ')[0];
            const isAfterStart = !dateRange.start || userDate >= dateRange.start;
            const isBeforeEnd = !dateRange.end || userDate <= dateRange.end;
            const isChannelMatch = !selectedChannel || user.channel === selectedChannel;
            return isAfterStart && isBeforeEnd && isChannelMatch;
        });
    }, [dateRange, selectedChannel]);

    // Aggregate Data for the Chart
    const trendData = useMemo(() => {
        const grouped = filteredData.reduce((acc, user) => {
            const date = user.submissionTime.split(' ')[0];
            if (!acc[date]) {
                acc[date] = { date, users: 0, members: 0 };
            }
            acc[date].users += 1;
            acc[date].members += user.familyMemberCount;
            return acc;
        }, {} as Record<string, { date: string; users: number; members: number }>);

        // Sort by date
        const groupedArray: { date: string; users: number; members: number }[] = Object.values(grouped) as { date: string; users: number; members: number }[];
        return groupedArray.sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredData]);

    const stats = useMemo(() => {
        const totalUsers = filteredData.length;
        const totalFamilyMembers = filteredData.reduce((acc, curr) => acc + curr.familyMemberCount, 0);
        
        const totalGaps = filteredData.reduce((acc, curr) => ({
            accident: acc.accident + curr.gaps.accident,
            medical: acc.medical + curr.gaps.medical,
            criticalIllness: acc.criticalIllness + curr.gaps.criticalIllness,
            termLife: acc.termLife + curr.gaps.termLife,
            annuity: acc.annuity + curr.gaps.annuity,
            education: acc.education + curr.gaps.education,
        }), { accident: 0, medical: 0, criticalIllness: 0, termLife: 0, annuity: 0, education: 0 });

        return { totalUsers, totalFamilyMembers, totalGaps };
    }, [filteredData]);

    const maxGapValue = Math.max(...(Object.values(stats.totalGaps) as number[]));

    const gapChartData = [
        { label: '意外险', value: stats.totalGaps.accident, color: 'bg-blue-500' },
        { label: '医疗险', value: stats.totalGaps.medical, color: 'bg-green-500' },
        { label: '重疾险', value: stats.totalGaps.criticalIllness, color: 'bg-red-500' },
        { label: '定期寿险', value: stats.totalGaps.termLife, color: 'bg-yellow-500' },
        { label: '养老金', value: stats.totalGaps.annuity, color: 'bg-purple-500' },
        { label: '教育金', value: stats.totalGaps.education, color: 'bg-indigo-500' },
    ];

    const formatBigNumber = (num: number) => {
        return (num / 10000).toFixed(0) + '万';
    };

    return (
        <div className="space-y-6 pb-10">
            <h1 className="text-2xl font-bold text-slate-900">数据看板</h1>

            {/* Filters */}
            <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
                <div className="flex flex-wrap items-end gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">开始日期</label>
                        <input 
                            type="date" 
                            value={dateRange.start}
                            onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="h-9 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">结束日期</label>
                        <input 
                            type="date" 
                            value={dateRange.end}
                            onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="h-9 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-brand-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">渠道筛选</label>
                        <select 
                            value={selectedChannel}
                            onChange={e => setSelectedChannel(e.target.value)}
                            className="h-9 px-3 py-2 border border-gray-300 bg-white rounded-md text-sm focus:ring-1 focus:ring-brand-blue-500 min-w-[150px]"
                        >
                            <option value="">全部渠道</option>
                            {channels.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <button 
                        onClick={() => { setDateRange({ start: '', end: '' }); setSelectedChannel(''); }}
                        className="h-9 px-4 bg-gray-100 text-gray-600 text-sm font-medium rounded-md hover:bg-gray-200 transition"
                    >
                        重置筛选
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">累计参与用户数</h3>
                    <div className="mt-2 flex items-baseline">
                        <span className="text-4xl font-extrabold text-blue-600">{stats.totalUsers}</span>
                        <span className="ml-2 text-sm font-medium text-gray-500">人</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">覆盖家庭成员总数</h3>
                    <div className="mt-2 flex items-baseline">
                        <span className="text-4xl font-extrabold text-orange-500">{stats.totalFamilyMembers}</span>
                        <span className="ml-2 text-sm font-medium text-gray-500">人</span>
                    </div>
                </div>
            </div>

            {/* Trend Chart */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="mb-6">
                    <h3 className="text-lg font-bold text-gray-800">用户使用规模趋势</h3>
                    <p className="text-sm text-gray-500">每日用户增长与家庭保障覆盖情况分析</p>
                </div>
                <TrendChart data={trendData} />
            </div>

            {/* Gap Analysis Chart */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-6">分险种缺口保额统计</h3>
                <div className="space-y-4">
                    {gapChartData.map((item) => (
                        <div key={item.label} className="relative">
                            <div className="flex justify-between items-center mb-1 text-sm font-medium text-gray-700">
                                <span>{item.label}</span>
                                <span>{formatBigNumber(item.value)}</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                                <div 
                                    className={`h-4 rounded-full ${item.color}`} 
                                    style={{ width: `${maxGapValue > 0 ? (item.value / maxGapValue) * 100 : 0}%`, transition: 'width 0.5s ease-in-out' }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DataDashboardPage;
