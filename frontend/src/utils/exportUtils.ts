import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PIIDetection } from '../types';

interface ExportData {
  originalText: string;
  anonymizedText: string;
  detections: PIIDetection[];
  inactiveOccurrences?: Set<number>;
  processingTime?: number;
  confidenceAvg?: number;
  chunksProcessed?: number;
  timestamp: string;
}

// CSV Export Function
export const exportToCSV = (data: ExportData, filename: string = 'sensitive_information_audit') => {
  // Prepare CSV headers
  const headers = [
    'Index',
    'Type',
    'Original Text',
    'Replacement',
    'Confidence (%)',
    'Explanation',
    'Status'
  ];

  // Prepare CSV rows
  const rows = data.detections.map((detection, index) => {
    const occurrenceIndex = detection.i ?? index;
    const isActive = !data.inactiveOccurrences?.has(occurrenceIndex);
    
    return [
      (index + 1).toString(),
      detection.type,
      `"${detection.original.replace(/"/g, '""')}"`, // Escape quotes in CSV
      `"${detection.replacement.replace(/"/g, '""')}"`,
      (detection.confidence * 100).toFixed(2),
      detection.explanation ? `"${detection.explanation.replace(/"/g, '""')}"` : '',
      isActive ? 'Active' : 'Inactive'
    ];
  });

  // Calculate active/inactive counts
  const activeCount = data.detections.filter((detection, index) => {
    const occurrenceIndex = detection.i ?? index;
    return !data.inactiveOccurrences?.has(occurrenceIndex);
  }).length;
  const inactiveCount = data.detections.length - activeCount;

  // Add summary row
  rows.push([]);
  rows.push(['Summary']);
  rows.push(['Total Items', data.detections.length.toString()]);
  rows.push(['Active Items', activeCount.toString()]);
  rows.push(['Inactive Items', inactiveCount.toString()]);
  rows.push(['Average Confidence', data.confidenceAvg ? `${(data.confidenceAvg * 100).toFixed(2)}%` : 'N/A']);
  rows.push(['Processing Time', data.processingTime ? `${data.processingTime.toFixed(2)}s` : 'N/A']);
  rows.push(['Chunks Processed', data.chunksProcessed?.toString() || '1']);
  rows.push(['Export Date', new Date(data.timestamp).toLocaleString()]);

  // Convert to CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${Date.now()}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Helper function to draw a pie chart
const drawPieChart = (
  pdf: jsPDF, 
  data: Array<{label: string, value: number, color: [number, number, number]}>,
  x: number, 
  y: number, 
  radius: number
) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return;
  
  let currentAngle = -Math.PI / 2; // Start at top
  
  data.forEach((item) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    
    // Draw the slice
    pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
    
    // Create the slice using lines
    const steps = Math.max(3, Math.floor(sliceAngle * 10)); // More steps for larger slices
    const angleStep = sliceAngle / steps;
    
    // Start from center
    pdf.setDrawColor(255, 255, 255);
    pdf.setLineWidth(0.5);
    
    // Draw filled triangle segments to create the slice
    for (let i = 0; i < steps; i++) {
      const angle1 = currentAngle + i * angleStep;
      const angle2 = currentAngle + (i + 1) * angleStep;
      
      const x1 = x + Math.cos(angle1) * radius;
      const y1 = y + Math.sin(angle1) * radius;
      const x2 = x + Math.cos(angle2) * radius;
      const y2 = y + Math.sin(angle2) * radius;
      
      // Draw filled triangle from center to arc segment
      pdf.triangle(x, y, x1, y1, x2, y2, 'F');
    }
    
    // Draw the arc outline
    const startX = x + Math.cos(currentAngle) * radius;
    const startY = y + Math.sin(currentAngle) * radius;
    const endX = x + Math.cos(currentAngle + sliceAngle) * radius;
    const endY = y + Math.sin(currentAngle + sliceAngle) * radius;
    
    pdf.line(x, y, startX, startY);
    pdf.line(x, y, endX, endY);
    
    currentAngle += sliceAngle;
  });
  
  // Draw border circle
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.2);
  pdf.circle(x, y, radius, 'S');
};

// PDF Export Function
export const exportToPDF = (data: ExportData, filename: string = 'sensitive_information_audit') => {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // Title
  pdf.setFontSize(20);
  pdf.setTextColor(33, 33, 33);
  pdf.text('Sensitive Information Audit Report', pageWidth / 2, 20, { align: 'center' });
  
  // Date and metadata
  pdf.setFontSize(10);
  pdf.setTextColor(100, 100, 100);
  pdf.text(`Generated: ${new Date(data.timestamp).toLocaleString()}`, pageWidth / 2, 30, { align: 'center' });
  
  // Calculate active/inactive counts for PDF
  const activeCountPDF = data.detections.filter((detection, index) => {
    const occurrenceIndex = detection.i ?? index;
    return !data.inactiveOccurrences?.has(occurrenceIndex);
  }).length;
  const inactiveCountPDF = data.detections.length - activeCountPDF;

  // Summary Section
  pdf.setFontSize(14);
  pdf.setTextColor(33, 33, 33);
  pdf.text('Summary', 14, 45);
  
  pdf.setFontSize(10);
  pdf.setTextColor(66, 66, 66);
  
  const summaryData = [
    ['Total Sensitive Items', data.detections.length.toString()],
    ['Active Items', activeCountPDF.toString()],
    ['Inactive Items', inactiveCountPDF.toString()],
    ['Average Confidence', data.confidenceAvg ? `${(data.confidenceAvg * 100).toFixed(2)}%` : 'N/A'],
    ['Processing Time', data.processingTime ? `${data.processingTime.toFixed(2)} seconds` : 'N/A'],
    ['Chunks Processed', data.chunksProcessed?.toString() || '1']
  ];
  
  let yPos = 52;
  summaryData.forEach(([label, value]) => {
    pdf.text(`${label}: ${value}`, 14, yPos);
    yPos += 6;
  });
  
  // Active/Inactive Status Distribution (if there are inactive items)
  if (inactiveCountPDF > 0) {
    pdf.setFontSize(12);
    pdf.setTextColor(33, 33, 33);
    pdf.text('Status Distribution', 120, 45);
    
    const statusPieData = [
      {
        label: 'Active',
        value: activeCountPDF,
        color: [34, 197, 94] as [number, number, number]  // Green
      },
      {
        label: 'Inactive',
        value: inactiveCountPDF,
        color: [156, 163, 175] as [number, number, number]  // Gray
      }
    ];
    
    // Draw small pie chart for active/inactive
    drawPieChart(pdf, statusPieData, 140, 65, 15);
    
    // Small legend
    pdf.setFontSize(8);
    statusPieData.forEach((item, index) => {
      const percentage = ((item.value / data.detections.length) * 100).toFixed(0);
      
      // Draw color box
      pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
      pdf.rect(160, 57 + (index * 8) - 2, 3, 3, 'F');
      
      // Add text
      pdf.setTextColor(66, 66, 66);
      pdf.text(`${item.label}: ${item.value} (${percentage}%)`, 165, 57 + (index * 8));
    });
  }
  
  // Statistics by Type
  const typeStats = data.detections.reduce((acc, detection) => {
    acc[detection.type] = (acc[detection.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Add pie chart for type distribution
  pdf.setFontSize(14);
  pdf.setTextColor(33, 33, 33);
  pdf.text('Detection Types Distribution', 14, yPos + 10);
  
  yPos += 20;
  
  // Prepare pie chart data with colors
  const typeColors: Array<[number, number, number]> = [
    [59, 130, 246],   // Blue
    [239, 68, 68],    // Red
    [34, 197, 94],    // Green
    [251, 146, 60],   // Orange
    [168, 85, 247],   // Purple
    [236, 72, 153],   // Pink
    [20, 184, 166],   // Teal
    [251, 191, 36],   // Amber
    [100, 116, 139],  // Slate
    [99, 102, 241],   // Indigo
  ];
  
  const pieData = Object.entries(typeStats).map(([type, count], index) => ({
    label: type,
    value: count,
    color: typeColors[index % typeColors.length]
  }));
  
  // Draw pie chart on the left
  const chartX = 45;
  const chartY = yPos + 25;
  const chartRadius = 20;
  
  drawPieChart(pdf, pieData, chartX, chartY, chartRadius);
  
  // Add legend on the right
  let legendY = yPos;
  pdf.setFontSize(9);
  pieData.forEach((item, index) => {
    const percentage = ((item.value / data.detections.length) * 100).toFixed(1);
    
    // Draw color box
    pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
    pdf.rect(80, legendY - 2, 4, 4, 'F');
    
    // Add text
    pdf.setTextColor(66, 66, 66);
    pdf.text(`${item.label}: ${item.value} items (${percentage}%)`, 87, legendY);
    
    legendY += 6;
  });
  
  yPos = Math.max(chartY + chartRadius + 10, legendY + 5);
  
  // Detailed Table
  pdf.addPage();
  pdf.setFontSize(14);
  pdf.setTextColor(33, 33, 33);
  pdf.text('Detailed Findings', 14, 20);
  
  // Table data
  const tableHeaders = ['#', 'Type', 'Original', 'Replacement', 'Confidence', 'Status', 'Explanation'];
  const tableData = data.detections.map((detection, index) => {
    const occurrenceIndex = detection.i ?? index;
    const isActive = !data.inactiveOccurrences?.has(occurrenceIndex);
    
    return [
      (index + 1).toString(),
      detection.type,
      detection.original.length > 20 ? detection.original.substring(0, 20) + '...' : detection.original,
      detection.replacement.length > 20 ? detection.replacement.substring(0, 20) + '...' : detection.replacement,
      `${(detection.confidence * 100).toFixed(0)}%`,
      isActive ? 'Active' : 'Inactive',
      detection.explanation ? 
        (detection.explanation.length > 25 ? detection.explanation.substring(0, 25) + '...' : detection.explanation) : 
        ''
    ];
  });
  
  // Generate table
  autoTable(pdf, {
    head: [tableHeaders],
    body: tableData,
    startY: 30,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 20 },
      2: { cellWidth: 30 },
      3: { cellWidth: 30 },
      4: { cellWidth: 18 },
      5: { cellWidth: 15 },
      6: { cellWidth: 'auto' },
    },
  });
  
  // Add confidence distribution chart on a new page if there's space
  const finalY = (pdf as any).lastAutoTable.finalY || 30;
  if (finalY > pageHeight - 60) {
    pdf.addPage();
    yPos = 20;
  } else {
    yPos = finalY + 20;
  }
  
  // Confidence Distribution
  pdf.setFontSize(14);
  pdf.setTextColor(33, 33, 33);
  pdf.text('Confidence Distribution', 14, yPos);
  
  yPos += 15;
  
  // Calculate confidence ranges (only for active items)
  const activeDetections = data.detections.filter((detection, index) => {
    const occurrenceIndex = detection.i ?? index;
    return !data.inactiveOccurrences?.has(occurrenceIndex);
  });
  
  const confidenceRanges = {
    'High (90-100%)': activeDetections.filter(d => d.confidence >= 0.9).length,
    'Medium (70-89%)': activeDetections.filter(d => d.confidence >= 0.7 && d.confidence < 0.9).length,
    'Low (< 70%)': activeDetections.filter(d => d.confidence < 0.7).length,
  };
  
  // Prepare pie chart data for confidence distribution
  const confidencePieData = [
    {
      label: 'High (90-100%)',
      value: confidenceRanges['High (90-100%)'],
      color: [34, 197, 94] as [number, number, number]  // Green
    },
    {
      label: 'Medium (70-89%)',
      value: confidenceRanges['Medium (70-89%)'],
      color: [251, 191, 36] as [number, number, number]  // Amber/Yellow
    },
    {
      label: 'Low (< 70%)',
      value: confidenceRanges['Low (< 70%)'],
      color: [239, 68, 68] as [number, number, number]  // Red
    }
  ].filter(item => item.value > 0); // Only include ranges with data
  
  if (confidencePieData.length > 0) {
    // Draw pie chart
    const confChartX = 45;
    const confChartY = yPos + 20;
    const confChartRadius = 20;
    
    drawPieChart(pdf, confidencePieData, confChartX, confChartY, confChartRadius);
    
    // Add legend
    let confLegendY = yPos + 5;
    pdf.setFontSize(9);
    confidencePieData.forEach((item) => {
      const percentage = activeDetections.length > 0 
        ? ((item.value / activeDetections.length) * 100).toFixed(1)
        : '0';
      
      // Draw color box
      pdf.setFillColor(item.color[0], item.color[1], item.color[2]);
      pdf.rect(80, confLegendY - 2, 4, 4, 'F');
      
      // Add text
      pdf.setTextColor(66, 66, 66);
      pdf.text(`${item.label}: ${item.value} items (${percentage}%)`, 87, confLegendY);
      
      confLegendY += 6;
    });
    
    yPos = Math.max(confChartY + confChartRadius + 10, confLegendY + 5);
  } else {
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    pdf.text('No active items to display', 20, yPos + 10);
    yPos += 20;
  }
  
  // Footer
  pdf.setFontSize(8);
  pdf.setTextColor(150, 150, 150);
  pdf.text('Generated by ChatANON - Sensitive Information Audit Tool', pageWidth / 2, pageHeight - 10, { align: 'center' });
  
  // Save the PDF
  pdf.save(`${filename}_${Date.now()}.pdf`);
};

// Helper function to prepare export data
export const prepareExportData = (
  originalText: string,
  anonymizedText: string,
  detections: PIIDetection[],
  inactiveOccurrences?: Set<number>,
  processingTime?: number,
  confidenceAvg?: number,
  chunksProcessed?: number
): ExportData => {
  return {
    originalText,
    anonymizedText,
    detections,
    inactiveOccurrences,
    processingTime,
    confidenceAvg,
    chunksProcessed,
    timestamp: new Date().toISOString()
  };
};