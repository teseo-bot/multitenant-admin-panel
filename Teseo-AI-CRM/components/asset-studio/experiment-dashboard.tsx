"use client";

import React, { useState } from "react";
import { useExperimentStats } from "@/hooks/queries/use-experiment-stats";
import { useExperimentTimeseries } from "@/hooks/queries/use-experiment-timeseries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, BarChart } from "@/components/charts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExperimentStatus } from "@/types/experiment";

interface ExperimentDashboardProps {
  experimentId: string;
  status?: ExperimentStatus;
}

export function ExperimentDashboard({ experimentId, status }: ExperimentDashboardProps) {
  const [timeInterval, setTimeInterval] = useState("day");
  
  const { 
    data: statsData, 
    isLoading: isStatsLoading, 
    isError: isStatsError 
  } = useExperimentStats(experimentId, status);
  
  const { 
    data: tsData, 
    isLoading: isTsLoading, 
    isError: isTsError 
  } = useExperimentTimeseries(experimentId, timeInterval, status);

  if (isStatsError || isTsError) {
    return (
      <div className="p-8 text-center text-red-500">
        <p>Error loading experiment data. Please try again.</p>
      </div>
    );
  }

  const isLoading = isStatsLoading || isTsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <Skeleton className="h-4 w-[100px]" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[60px]" />
                <Skeleton className="h-3 w-[120px] mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle><Skeleton className="h-6 w-[150px]" /></CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle><Skeleton className="h-6 w-[150px]" /></CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!statsData || statsData.length === 0 || !statsData.some((v) => v.impressions > 0)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 border rounded-lg bg-slate-50 dark:bg-slate-900/20">
        <div className="w-16 h-16 text-slate-300">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Waiting for first impressions...</h3>
        <p className="text-slate-500 text-center max-w-sm">
          No traffic has been routed to this experiment yet. Data will appear here once leads start interacting.
        </p>
      </div>
    );
  }

  const totals = statsData.reduce(
    (acc, curr) => {
      acc.impressions += curr.impressions;
      acc.meetingsBooked += curr.meetingsBooked;
      return acc;
    },
    { impressions: 0, meetingsBooked: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Experiment Results</h2>
          <p className="text-muted-foreground">Compare performance across variants</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Interval:</span>
          <Select value={timeInterval} onValueChange={(val) => setTimeInterval(val as string)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Select interval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">Hourly</SelectItem>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Impressions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.impressions.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.meetingsBooked.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Variants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsData.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="charts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="data">Data Table</TabsTrigger>
        </TabsList>
        <TabsContent value="charts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Convergence Rate</CardTitle>
                <CardDescription>Conversion over time by variant</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                {tsData && tsData.length > 0 ? (
                  <LineChart data={tsData} />
                ) : (
                  <div className="h-72 flex items-center justify-center text-muted-foreground">
                    Not enough timeseries data.
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="col-span-3">
              <CardHeader>
                <CardTitle>Distribution</CardTitle>
                <CardDescription>Overall conversion rate by variant</CardDescription>
              </CardHeader>
              <CardContent className="pl-2">
                <BarChart data={statsData} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle>Variant Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50 rounded-t-md">
                    <tr>
                      <th className="px-4 py-3">Variant</th>
                      <th className="px-4 py-3 text-right">Traffic</th>
                      <th className="px-4 py-3 text-right">Responses</th>
                      <th className="px-4 py-3 text-right">Positives</th>
                      <th className="px-4 py-3 text-right">Conv. Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsData.map((stat) => (
                      <tr key={stat.variantId} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{stat.label}</td>
                        <td className="px-4 py-3 text-right">{stat.impressions}</td>
                        <td className="px-4 py-3 text-right">{stat.responseRate}%</td>
                        <td className="px-4 py-3 text-right">{stat.positiveRate}%</td>
                        <td className="px-4 py-3 text-right font-bold">{stat.conversionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
