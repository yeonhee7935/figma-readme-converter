// Figma 플러그인 UI 표시 - 크기 지정
figma.showUI(__html__, { width: 450, height: 650 });

// 인터페이스 정의
interface MarkdownSettings {
  frameWidth: number;
  frameHeight: number;
  padding: number;
  textSize: string;
  textColor: string;
  headingSizes: {
    h1: number;
    h2: number;
    h3: number;
  };
  fontFamily: string;
}

// 기본 설정값
const defaultSettings: MarkdownSettings = {
  frameWidth: 1080,
  frameHeight: 1080,
  padding: 40,
  textSize: 'medium',
  textColor: '#000000',
  headingSizes: {
    h1: 64,
    h2: 48,
    h3: 36
  },
  fontFamily: 'Inter'
};

// 마크다운 파싱 후 생성될 요소 타입 정의
type MarkdownElement = 
  | { type: 'heading', level: number, content: string }
  | { type: 'paragraph', content: string }
  | { type: 'list', items: { indent: number, content: string }[] }
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

// 마크다운 파싱 함수
function parseMarkdown(markdown: string): MarkdownElement[] {
  const lines = markdown.split('\n');
  const elements: MarkdownElement[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // 빈 줄 건너뛰기
    if (line === '') {
      i++;
      continue;
    }
    
    // 헤딩 처리 (# 헤딩)
    if (line.startsWith('#')) {
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
      elements.push({
        type: 'separator'
      });
    }
    // 목록 처리 (-, *, +)
    else if (line.match(/^[-*+]\s+/)) {
      // 목록의 시작
      const listItems: { indent: number, content: string }[] = [];
      
      while (i < lines.length) {
        const listLine = lines[i].trim();
        
        // 목록이 끝났는지 확인
        if (listLine === '' || !listLine.match(/^[-*+]\s+/)) {
          // 빈 줄이면 계속 진행, 아니면 반복 중단
          if (listLine === '') {
            i++;
            continue;
          } else {
            break;
          }
        }
        
        const indent = lines[i].search(/\S/);
        const content = listLine.replace(/^[-*+]\s+/, '');
        
        listItems.push({
          indent,
          content
        });
        
        i++;
      }
      
      if (listItems.length > 0) {
        elements.push({
          type: 'list',
          items: listItems
        });
      }
      
      // 다음 줄 처리를 위해 인덱스 조정
      continue;
    }
    // 일반 텍스트
    else {
      elements.push({
        type: 'paragraph',
        content: line
      });
    }
    
    i++;
  }
  
  return elements;
}

// 마크다운을 Figma 프레임으로 변환
async function convertMarkdownToFigma(markdown: string, settings: MarkdownSettings): Promise<void> {
  // 마크다운 파싱
  const elements = parseMarkdown(markdown);
  
  if (elements.length === 0) {
    figma.notify('변환할 마크다운 내용이 없습니다.');
    return;
  }
  
  // 설정 적용
  const frameWidth = settings.frameWidth;
  const frameHeight = settings.frameHeight;
  const padding = settings.padding;
  const textColor = settings.textColor;
  const fontFamily = settings.fontFamily;
  
  // 텍스트 크기 설정
  const textSizes = {
    paragraph: settings.textSize === 'large' ? 24 : settings.textSize === 'medium' ? 18 : 14,
  };
  
  // 헤딩 크기 설정
  const headingSizes = settings.headingSizes;
  
  // 첫 프레임 생성
  let currentFrame = figma.createFrame();
  currentFrame.resize(frameWidth, frameHeight);
  currentFrame.name = "Markdown Frame 1";
  currentFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  
  let currentY = padding;
  let frameIndex = 1;
  
  // 폰트 로딩
  try {
    await figma.loadFontAsync({ family: fontFamily, style: "Regular" });
    await figma.loadFontAsync({ family: fontFamily, style: "Bold" });
    await figma.loadFontAsync({ family: fontFamily, style: "Medium" });
  } catch (error) {
    console.error("폰트 로딩 실패:", error);
    // 기본 폰트로 대체
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    await figma.loadFontAsync({ family: "Inter", style: "Medium" });
  }
  
  // 요소들을 반복하며 Figma 객체 생성
  for (const element of elements) {
    // 구분자를 만나면 새 프레임 생성
    if (element.type === 'separator') {
      frameIndex++;
      currentFrame = figma.createFrame();
      currentFrame.resize(frameWidth, frameHeight);
      currentFrame.name = `Markdown Frame ${frameIndex}`;
      currentFrame.x = (frameIndex - 1) * frameWidth;
      currentFrame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      currentY = padding;
      continue;
    }
    
    // 헤딩 처리
    if (element.type === 'heading') {
      const textNode = figma.createText();
      textNode.characters = element.content;
      textNode.x = padding;
      textNode.y = currentY;
      
      // RGB 색상값으로 변환
      const color = hexToRgb(textColor);
      textNode.fills = [{ type: 'SOLID', color }];
      
      // 헤딩 레벨에 따른 크기 및 스타일 설정
      if (element.level === 1) {
        textNode.fontSize = headingSizes.h1;
        textNode.fontName = { family: fontFamily, style: "Bold" };
      } else if (element.level === 2) {
        textNode.fontSize = headingSizes.h2;
        textNode.fontName = { family: fontFamily, style: "Bold" };
      } else {
        textNode.fontSize = headingSizes.h3;
        textNode.fontName = { family: fontFamily, style: "Medium" };
      }
      
      currentFrame.appendChild(textNode);
      
      // 다음 요소를 위한 Y 위치 업데이트
      currentY += textNode.height + 20;
    }
    
    // 목록 처리
    else if (element.type === 'list') {
      let baseIndent = Infinity;
      
      // 기본 들여쓰기 레벨 찾기
      for (const item of element.items) {
        baseIndent = Math.min(baseIndent, item.indent);
      }
      
      for (const item of element.items) {
        const textNode = figma.createText();
        textNode.characters = "• " + item.content;
        
        // 들여쓰기 레벨에 따른 X 위치 계산
        const indentLevel = Math.floor((item.indent - baseIndent) / 2);
        textNode.x = padding + (indentLevel * 20);
        textNode.y = currentY;
        textNode.fontSize = textSizes.paragraph;
        textNode.fontName = { family: fontFamily, style: "Regular" };
        
        // RGB 색상값으로 변환
        const color = hexToRgb(textColor);
        textNode.fills = [{ type: 'SOLID', color }];
        
        currentFrame.appendChild(textNode);
        currentY += textNode.height + 10;
      }
    }
    
    // 일반 텍스트
    else if (element.type === 'paragraph') {
      const textNode = figma.createText();
      textNode.characters = element.content;
      textNode.x = padding;
      textNode.y = currentY;
      textNode.fontSize = textSizes.paragraph;
      textNode.fontName = { family: fontFamily, style: "Regular" };
      
      // RGB 색상값으로 변환
      const color = hexToRgb(textColor);
      textNode.fills = [{ type: 'SOLID', color }];
      
      currentFrame.appendChild(textNode);
      currentY += textNode.height + 15;
    }
  }
  
  // 생성된 프레임 선택 및 뷰포트 조정
  const frames = figma.currentPage.findAll(node => node.type === 'FRAME' && node.name.startsWith('Markdown Frame'));
  if (frames.length > 0) {
    figma.currentPage.selection = frames as SceneNode[];
    figma.viewport.scrollAndZoomIntoView(frames as SceneNode[]);
  }
  
  figma.notify("마크다운이 성공적으로 변환되었습니다!");
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