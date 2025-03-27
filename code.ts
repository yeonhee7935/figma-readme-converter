// Figma 플러그인 UI 표시 - 크기 지정
figma.showUI(__html__, { width: 450, height: 650 });

// 인터페이스 정의
interface MarkdownSettings {
  frameWidth: number;
  frameHeight: number;
  padding: number;
  textSize: number;
  textColor: string;
  headingSizes: {
    h1: number;
    h2: number;
    h3: number;
  };
  fontFamily: string;
  lineHeight: number;
  letterSpacing: number;
  frameSpacing: number;
  elementSpacing: number;
}

// 기본 설정값
const defaultSettings: MarkdownSettings = {
  frameWidth: 1440,
  frameHeight: 1080,
  padding: 100,
  textSize: 36,
  textColor: '#121212',
  headingSizes: {
    h1: 100,
    h2: 72,
    h3: 54
  },
  fontFamily: 'Inter',
  lineHeight: 64,
  letterSpacing: -2.5,
  frameSpacing: 100,
  elementSpacing: 24
};

// 마크다운 파싱 후 생성될 요소 타입 정의
type MarkdownElement = 
  | { type: 'heading', level: number, content: string }
  | { type: 'text', content: string }
  | { type: 'separator' };

// 사용자 설정 로드
async function loadUserSettings(): Promise<MarkdownSettings> {
  try {
    const settings = await figma.clientStorage.getAsync('markdownSettings') as MarkdownSettings;
    return settings || defaultSettings;
  } catch (error) {
    return defaultSettings;
  }
}

// 사용자 설정 저장
async function saveUserSettings(settings: MarkdownSettings): Promise<void> {
  await figma.clientStorage.setAsync('markdownSettings', settings);
}

// HEX 색상을 RGB 색상으로 변환
function hexToRgb(hex: string): { r: number, g: number, b: number } {
  hex = hex.replace(/^#/, '');
  
  // 3자리 HEX 색상인 경우 6자리로 확장
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  return { r, g, b };
}

// 마크다운 파싱 함수 - 헤딩과 일반 텍스트만 구분
function parseMarkdown(markdown: string): MarkdownElement[] {
  const lines = markdown.split('\n');
  const elements: MarkdownElement[] = [];
  
  let currentTextContent: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 빈 줄 건너뛰기
    if (line === '') {
      continue;
    }
    
    // 헤딩 처리 (# 헤딩)
    if (line.startsWith('#')) {
      // 이전에 모은 텍스트가 있으면 먼저 추가
      if (currentTextContent.length > 0) {
        elements.push({
          type: 'text',
          content: currentTextContent.join('\n')
        });
        currentTextContent = [];
      }
      
      const match = line.match(/^(#+)\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const content = match[2];
        elements.push({
          type: 'heading',
          level,
          content
        });
      }
    } 
    // 구분자 처리 (---)
    else if (line.match(/^-{3,}$/)) {
      // 이전에 모은 텍스트가 있으면 먼저 추가
      if (currentTextContent.length > 0) {
        elements.push({
          type: 'text',
          content: currentTextContent.join('\n')
        });
        currentTextContent = [];
      }
      
      elements.push({
        type: 'separator'
      });
    }
    // 일반 텍스트 - 헤딩이나 구분자가 아닌 모든 텍스트는 하나로 모음
    else {
      currentTextContent.push(line);
    }
  }
  
  // 남은 텍스트가 있으면 추가
  if (currentTextContent.length > 0) {
    elements.push({
      type: 'text',
      content: currentTextContent.join('\n')
    });
  }
  
  return elements;
}

// 텍스트 스타일 적용
function applyTextStyle(
  textNode: TextNode, 
  fontSize: number, 
  fontFamily: string, 
  textColor: string,
  fontStyle: string = "Regular",
  lineHeight?: number,
  letterSpacing?: number
) {
  // 폰트 스타일 지정
  textNode.fontName = { family: fontFamily, style: fontStyle };
  textNode.fontSize = fontSize;
  
  // 행간 설정 (선택적)
  if (lineHeight !== undefined) {
    textNode.lineHeight = {
      value: lineHeight,
      unit: 'PIXELS'
    };
  }
  
  // 자간 설정 (선택적, letterSpacing은 퍼센트로 입력받지만 픽셀로 변환)
  if (letterSpacing !== undefined) {
    textNode.letterSpacing = {
      value: letterSpacing / 100 * fontSize,
      unit: 'PIXELS'
    };
  }
  
  // 색상 설정
  const color = hexToRgb(textColor);
  textNode.fills = [{ type: 'SOLID', color }];
  
  // 자동 너비 조정
  textNode.textAutoResize = "WIDTH_AND_HEIGHT";
}

// 새 프레임 생성 및 설정
function createNewFrame(
  settings: MarkdownSettings,
  frameIndex: number,
  framesPerRow: number
): FrameNode {
  const currentFrame = figma.createFrame();
  currentFrame.resize(settings.frameWidth, settings.frameHeight);
  currentFrame.name = `Markdown Frame ${frameIndex}`;
  
  // 프레임 위치 계산 (줄바꿈 고려)
  const rowIndex = Math.floor((frameIndex - 1) / framesPerRow);
  const columnIndex = (frameIndex - 1) % framesPerRow;
  
  currentFrame.x = columnIndex * (settings.frameWidth + settings.frameSpacing);
  currentFrame.y = rowIndex * (settings.frameHeight + settings.frameSpacing);
  
  // 프레임 배경 설정
  currentFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  
  // 오토레이아웃 대신 고정 레이아웃 사용, 패딩은 요소 위치로 조정
  // 내용이 넘치면 잘림 처리
  currentFrame.clipsContent = true;
  
  return currentFrame;
}

// 마크다운을 Figma 프레임으로 변환
async function convertMarkdownToFigma(markdown: string, settings: MarkdownSettings): Promise<void> {
  // 마크다운 파싱
  const elements = parseMarkdown(markdown);
  
  if (elements.length === 0) {
    figma.notify('변환할 마크다운 내용이 없습니다.');
    return;
  }
  
  // 폰트 로딩
  try {
    await figma.loadFontAsync({ family: settings.fontFamily, style: "Regular" });
    await figma.loadFontAsync({ family: settings.fontFamily, style: "Bold" });
    await figma.loadFontAsync({ family: settings.fontFamily, style: "Medium" });
  } catch (error) {
    console.error("폰트 로딩 실패:", error);
    // 기본 폰트로 대체
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
    
    // 폰트 설정 업데이트
    settings.fontFamily = "Inter";
  }
  
  // 한 줄에 배치할 최대 프레임 수
  const framesPerRow = 10;
  
  // 첫 프레임 생성
  let currentFrame = createNewFrame(settings, 1, framesPerRow);
  let frameIndex = 1;
  
  // 현재 Y 위치 - 패딩으로 시작
  let currentY = settings.padding;
  
  // 요소들을 반복하며 Figma 객체 생성
  for (const element of elements) {
    // 구분자를 만나면 새 프레임 생성
    if (element.type === 'separator') {
      frameIndex++;
      currentFrame = createNewFrame(settings, frameIndex, framesPerRow);
      currentY = settings.padding;
      continue;
    }
    
    // 헤딩 처리
    if (element.type === 'heading') {
      const textNode = figma.createText();
      textNode.characters = element.content;
      
      // 헤딩 레벨에 따른 크기 및 스타일 설정
      if (element.level === 1) {
        applyTextStyle(
          textNode, 
          settings.headingSizes.h1, 
          settings.fontFamily, 
          settings.textColor,
          "Bold"
          // 헤딩은 행간 설정 제외
        );
      } else if (element.level === 2) {
        applyTextStyle(
          textNode, 
          settings.headingSizes.h2, 
          settings.fontFamily, 
          settings.textColor,
          "Bold"
          // 헤딩은 행간 설정 제외
        );
      } else {
        applyTextStyle(
          textNode, 
          settings.headingSizes.h3, 
          settings.fontFamily, 
          settings.textColor,
          "Medium"
          // 헤딩은 행간 설정 제외
        );
      }
      
      // 위치 설정
      textNode.x = settings.padding;
      textNode.y = currentY;
      
      // 프레임에 추가
      currentFrame.appendChild(textNode);
      
      // 다음 요소 위치 업데이트
      currentY += textNode.height + settings.elementSpacing;
    }
    
    // 일반 텍스트 (모든 비헤딩 텍스트를 포함)
    else if (element.type === 'text') {
      const textNode = figma.createText();
      textNode.characters = element.content;
      
      // 텍스트 스타일 적용 (행간 및 자간 포함)
      applyTextStyle(
        textNode, 
        settings.textSize, 
        settings.fontFamily, 
        settings.textColor,
        "Regular",
        settings.lineHeight,
        settings.letterSpacing
      );
      
      // 위치 설정
      textNode.x = settings.padding;
      textNode.y = currentY;
      textNode.resize(
        settings.frameWidth - (settings.padding * 2),
        textNode.height
      );
      
      // 프레임에 추가
      currentFrame.appendChild(textNode);
      
      // 다음 요소 위치 업데이트
      currentY += textNode.height + settings.elementSpacing;
    }
  }
  
  // 생성된 프레임 선택 및 뷰포트 조정
  const frames = figma.currentPage.findAll(node => 
    node.type === 'FRAME' && node.name.startsWith('Markdown Frame')
  );
  
  if (frames.length > 0) {
    figma.currentPage.selection = frames as SceneNode[];
    figma.viewport.scrollAndZoomIntoView(frames as SceneNode[]);
  }
  
  figma.notify("마크다운이 성공적으로 변환되었습니다!");
}

// 플러그인 시작 시 설정 로드하여 UI에 전달
(async () => {
  const settings = await loadUserSettings();
  figma.ui.postMessage({
    type: 'load-settings',
    settings
  });
})();

// Figma에서 사용 가능한 폰트 목록 가져오기
(async () => {
  try {
    const fonts = await figma.listAvailableFontsAsync();
    const fontFamilies = [...new Set(fonts.map(font => font.fontName.family))];
    
    figma.ui.postMessage({
      type: 'fonts-list',
      fonts: fontFamilies
    });
  } catch (error) {
    console.error("폰트 목록 로드 실패:", error);
  }
})();

// UI에서 메시지 수신 처리
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'convert-markdown') {
    await convertMarkdownToFigma(msg.markdown, msg.settings);
  } else if (msg.type === 'save-settings') {
    await saveUserSettings(msg.settings);
    figma.notify('설정이 저장되었습니다.');
  }
};