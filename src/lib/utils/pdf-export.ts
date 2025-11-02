import { jsPDF } from 'jspdf';
import { AIAnalysisResult } from '@/types/ai';

export function exportAnalysisToPDF(analysis: AIAnalysisResult) {
  const doc = new jsPDF();

  // Başlık
  doc.setFontSize(18);
  doc.text('İhale Analiz Raporu', 105, 20, { align: 'center' });

  // Tarih
  doc.setFontSize(10);
  doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 105, 30, { align: 'center' });

  let yPos = 45;

  // Kurum Bilgileri
  doc.setFontSize(14);
  doc.text('Kurum Bilgileri', 20, yPos);
  yPos += 10;

  doc.setFontSize(11);
  doc.text(`Kurum: ${analysis.extracted_data.kurum || 'Belirtilmemiş'}`, 20, yPos);
  yPos += 7;
  doc.text(`İhale Türü: ${analysis.extracted_data.ihale_turu || 'Belirtilmemiş'}`, 20, yPos);
  yPos += 7;
  doc.text(`Kişi Sayısı: ${analysis.extracted_data.kisi_sayisi || 'N/A'}`, 20, yPos);
  yPos += 7;
  doc.text(`Öğün Sayısı: ${analysis.extracted_data.ogun_sayisi || 'N/A'}`, 20, yPos);
  yPos += 7;
  doc.text(`Gün Sayısı: ${analysis.extracted_data.gun_sayisi || 'N/A'}`, 20, yPos);
  yPos += 7;
  doc.text(`Tahmini Bütçe: ${analysis.extracted_data.tahmini_butce?.toLocaleString('tr-TR') || 'N/A'} TL`, 20, yPos);
  yPos += 15;

  // Güven Skoru
  doc.setFontSize(14);
  doc.text('Güven Skoru', 20, yPos);
  yPos += 10;

  doc.setFontSize(11);
  const confidencePercent = Math.round(analysis.extracted_data.guven_skoru * 100);
  doc.text(`Analiz Güveni: %${confidencePercent}`, 20, yPos);
  yPos += 15;

  // Bütçe Uygunluğu
  doc.setFontSize(14);
  doc.text('Bütçe Analizi', 20, yPos);
  yPos += 10;

  doc.setFontSize(11);
  doc.text(`Durum: ${analysis.contextual_analysis.butce_uygunlugu.durum}`, 20, yPos);
  yPos += 7;
  doc.text(`Uygunluk: %${Math.round(analysis.contextual_analysis.butce_uygunlugu.oran * 100)}`, 20, yPos);
  yPos += 7;

  const aciklamaLines = doc.splitTextToSize(analysis.contextual_analysis.butce_uygunlugu.aciklama, 170);
  doc.text(aciklamaLines, 20, yPos);
  yPos += (aciklamaLines.length * 7) + 10;

  // Yeni sayfa
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }

  // Operasyonel Riskler
  doc.setFontSize(14);
  doc.text('Operasyonel Riskler', 20, yPos);
  yPos += 10;

  doc.setFontSize(11);
  doc.text(`Seviye: ${analysis.contextual_analysis.operasyonel_riskler.seviye}`, 20, yPos);
  yPos += 10;

  analysis.contextual_analysis.operasyonel_riskler.faktorler.slice(0, 5).forEach((risk, index) => {
    const riskLines = doc.splitTextToSize(`${index + 1}. ${risk}`, 170);
    doc.text(riskLines, 20, yPos);
    yPos += (riskLines.length * 7);

    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
  });

  // Footer
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.text(`ProCheff AI - Sayfa ${i}/${pageCount}`, 105, 285, { align: 'center' });
  }

  // PDF'i kaydet
  const filename = `ihale-analiz-${Date.now()}.pdf`;
  doc.save(filename);

  return filename;
}
