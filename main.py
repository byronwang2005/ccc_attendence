import sys
import os
import datetime
import webbrowser
import tkinter as tk
from tkinter import ttk, messagebox
from typing import Optional, Tuple, List
from PIL import ImageTk, Image
import qrcode

# Constants
WINDOW_WIDTH = 720
WINDOW_HEIGHT = 1000
MIN_WIDTH = 600
MIN_HEIGHT = 800
BG_COLOR = "#faf6ef"
CARD_BG_COLOR = "#ffffff"
THEME_COLOR = "#10263B"
ACCENT_COLOR = "#37B4B0"
BORDER_COLOR = "#cfd4d8"
NOTE_BG_COLOR = "#d7f0ef"
FONT_NORMAL = ("Segoe UI", 11)
FONT_BOLD = ("Segoe UI", 12, "bold")
FONT_TITLE = ("Segoe UI", 16, "bold")

def resource_path(relative_path: str) -> str:
    """Get absolute path to resource, works for dev and PyInstaller"""
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS  # type: ignore
    except AttributeError:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

def datetime_to_timestamp(year: int, month: int, day: int, hour: int, minute: int) -> int:
    """Convert datetime components to millisecond timestamp"""
    dt = datetime.datetime(year, month, day, hour, minute)
    return int(dt.timestamp() * 1000)

def generate_attendance_url(schedule_id: str, mode: str = "auto", manual_time: Optional[Tuple[int, ...]] = None) -> str:
    """Generate the attendance URL based on schedule ID and time"""
    if mode == "manual" and manual_time:
        ts = datetime_to_timestamp(*manual_time) # type: ignore
    else:
        # Default: current time + 1 minute (60000ms)
        ts = int(datetime.datetime.now().timestamp() * 1000 + 60000)
    return f"https://ccc.nottingham.edu.cn/study/attendance?scheduleId={schedule_id}&time={ts}"

def make_qr_image(url: str) -> Image.Image:
    """Generate QR code image from URL"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=8,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    return qr.make_image(fill_color="white", back_color=THEME_COLOR)

class QRGeneratorApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.setup_window()
        self.setup_styles()
        self.create_widgets()

    def setup_window(self):
        self.root.title("UNNC中国文化课签到二维码生成器")
        self.root.update_idletasks()
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        center_x = int((screen_width - WINDOW_WIDTH) / 2)
        center_y = int((screen_height - WINDOW_HEIGHT) / 2)
        self.root.geometry(f"{WINDOW_WIDTH}x{WINDOW_HEIGHT}+{center_x}+{center_y}")
        self.root.minsize(MIN_WIDTH, MIN_HEIGHT)
        self.root.resizable(True, True)
        self.root.configure(bg=BG_COLOR)

    def setup_styles(self):
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
            
        style.configure("App.TFrame", background=BG_COLOR)
        style.configure("Card.TFrame", background=CARD_BG_COLOR)
        style.configure("TLabel", padding=4, font=FONT_NORMAL)
        style.configure(
            "Card.TLabel",
            background=CARD_BG_COLOR,
            foreground=THEME_COLOR,
            padding=4,
            font=FONT_BOLD,
        )
        style.configure(
            "Card.TRadiobutton",
            background=CARD_BG_COLOR,
            foreground=THEME_COLOR,
            padding=4,
            font=FONT_NORMAL,
        )
        style.configure("App.TEntry", fieldbackground=CARD_BG_COLOR)
        style.configure(
            "Theme.TButton",
            background=THEME_COLOR,
            foreground="#ffffff",
            padding=8,
            font=("Segoe UI", 12),
        )
        style.map("Theme.TButton", background=[["active", "#0d1f2f"]])

    def create_widgets(self):
        # Header
        header_frame = tk.Frame(self.root, bg=BG_COLOR)
        header_frame.pack(fill="x", pady=(20, 10))
        
        try:
            logo_path = resource_path("public/ccc.webp")
            if os.path.exists(logo_path):
                logo_img = Image.open(logo_path)
                aspect_ratio = logo_img.width / logo_img.height
                new_height = 100
                new_width = int(new_height * aspect_ratio)
                logo_img = logo_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                self.logo_photo = ImageTk.PhotoImage(logo_img)
                tk.Label(header_frame, image=self.logo_photo, bg=BG_COLOR).pack()
        except Exception as e:
            print(f"无法加载 Logo: {e}")

        tk.Label(
            header_frame, 
            text="UNNC中国文化课签到二维码生成器",
            font=FONT_TITLE,
            bg=BG_COLOR,
            fg=THEME_COLOR
        ).pack(pady=(10, 0))

        # Instructions
        self.create_instruction_card()

        # Main Content
        main_frame = tk.Frame(self.root, bg=BG_COLOR)
        main_frame.pack(fill="both", expand=True, padx=20)

        # URL Input
        self.create_url_input(main_frame)

        # Mode Selection
        self.create_mode_selection(main_frame)

        # Generate Button
        self.generate_btn = ttk.Button(
            main_frame,
            text="生成签到二维码",
            command=self.generate_qr,
            style="Theme.TButton",
        )
        self.generate_btn.pack(pady=12, fill="x")

        # QR Preview
        self.create_qr_preview()

        # Footer
        self.create_footer()

    def create_instruction_card(self):
        instruction = (
            "- 仅限 eduroam / UNNC-living / UNNC_IPSec VPN 环境使用\n"
            "- 有答题选项时不要忘记答题\n"
            "- e.g.若日历下课时间为 20:00 ，则最佳签到时间窗口为 19:50-20:00\n"
            "- 使用步骤详见 教程"
        )
        note_frame = tk.Frame(
            self.root,
            bg=NOTE_BG_COLOR,
            highlightbackground=ACCENT_COLOR,
            highlightthickness=1,
            bd=0,
        )
        tk.Label(
            note_frame,
            text=instruction,
            justify="left",
            anchor="w",
            bg=NOTE_BG_COLOR,
            fg=THEME_COLOR,
            padx=10,
            pady=8,
            wraplength=600,
        ).pack(fill="x")
        
        link_label = tk.Label(
            note_frame, text="教程", bg=NOTE_BG_COLOR, fg=ACCENT_COLOR, cursor="hand2"
        )
        link_label.pack(anchor="w", padx=10, pady=(0, 8))
        link_label.bind(
            "<Button-1>",
            lambda e: webbrowser.open(
                "https://github.com/byronwang2005/CCC-Attendance-QRcode-Generator/tree/main?tab=readme-ov-file#%E5%A6%82%E4%BD%95%E4%BD%BF%E7%94%A8"
            ),
        )
        note_frame.pack(fill="x", padx=15, pady=(10, 10))

    def create_url_input(self, parent):
        link_card = tk.Frame(
            parent,
            bg=CARD_BG_COLOR,
            highlightbackground=BORDER_COLOR,
            highlightthickness=1,
            bd=0,
        )
        tk.Label(
            link_card,
            text="课程详情链接",
            bg=CARD_BG_COLOR,
            fg=THEME_COLOR,
            font=FONT_BOLD,
        ).pack(anchor="w")
        
        self.url_entry = tk.Entry(
            link_card,
            width=80,
            relief="solid",
            bd=1,
            highlightthickness=2,
            highlightbackground=BORDER_COLOR,
            highlightcolor=ACCENT_COLOR,
        )
        self.url_entry.pack(pady=(8, 0), fill="x")
        self.url_entry.bind(
            "<FocusIn>",
            lambda e: (
                self.url_entry.selection_range(0, "end"),
                self.url_entry.config(
                    highlightbackground=ACCENT_COLOR, highlightcolor=ACCENT_COLOR
                ),
            ),
        )
        self.url_entry.bind(
            "<FocusOut>", lambda e: self.url_entry.config(highlightbackground=BORDER_COLOR)
        )
        self.url_entry.focus_set()
        link_card.pack(fill="x", pady=12)

    def create_mode_selection(self, parent):
        self.mode = tk.StringVar(value="auto")
        mode_card = tk.Frame(
            parent,
            bg=CARD_BG_COLOR,
            highlightbackground=BORDER_COLOR,
            highlightthickness=1,
            bd=0,
        )
        tk.Label(
            mode_card,
            text="时间模式",
            bg=CARD_BG_COLOR,
            fg=THEME_COLOR,
            font=FONT_BOLD,
        ).pack(anchor="w")
        
        mode_frame = tk.Frame(mode_card, bg=CARD_BG_COLOR)
        mode_frame.pack(pady=(4, 0))
        ttk.Radiobutton(
            mode_frame,
            text="自动",
            variable=self.mode,
            value="auto",
            command=self.toggle_time_input,
            style="Card.TRadiobutton",
        ).pack(side=tk.LEFT, padx=15)
        ttk.Radiobutton(
            mode_frame,
            text="手动",
            variable=self.mode,
            value="manual",
            command=self.toggle_time_input,
            style="Card.TRadiobutton",
        ).pack(side=tk.LEFT, padx=15)
        
        self.time_frame = tk.Frame(mode_card, bg=CARD_BG_COLOR)
        self.create_time_inputs()
        mode_card.pack(fill="x", pady=12)

    def create_time_inputs(self):
        labels = ["年:", "月:", "日:", "时:", "分:"]
        now = datetime.datetime.now()
        defaults = [now.year, now.month, now.day, now.hour, now.minute]
        self.entries = []
        for i, (lbl, default) in enumerate(zip(labels, defaults)):
            row = i // 3
            col = (i % 3) * 2
            tk.Label(self.time_frame, text=lbl, bg=CARD_BG_COLOR, fg=THEME_COLOR).grid(
                row=row, column=col, padx=2, pady=4
            )
            width = 5 if "年" in lbl else 4
            entry = ttk.Entry(
                self.time_frame, width=width, justify="center", style="App.TEntry"
            )
            entry.insert(0, str(default))
            entry.grid(row=row, column=col + 1, padx=2, pady=4)
            self.entries.append(entry)

    def create_qr_preview(self):
        qr_card = tk.Frame(
            self.root,
            bg=CARD_BG_COLOR,
            highlightbackground=BORDER_COLOR,
            highlightthickness=1,
            bd=0,
        )
        tk.Label(
            qr_card,
            text="二维码预览",
            bg=CARD_BG_COLOR,
            fg=THEME_COLOR,
            font=FONT_BOLD,
        ).pack(anchor="w")
        self.qr_label = ttk.Label(qr_card)
        self.qr_label.pack(pady=8)
        qr_card.pack(fill="x", padx=20, pady=(5, 10))

    def create_footer(self):
        footer_frame = tk.Frame(self.root, bg=BG_COLOR)
        footer_frame.pack(side="bottom", fill="x", pady=10)
        
        footer_text = tk.Label(
            footer_frame,
            text="Licensed under MIT License | Developed by ",
            font=("Segoe UI", 9),
            bg=BG_COLOR,
            fg="#888888"
        )
        footer_text.pack(side="left", padx=(0, 0), expand=True, anchor="e")
        
        link_label = tk.Label(
            footer_frame,
            text="byron.wang",
            font=("Segoe UI", 9, "underline"),
            bg=BG_COLOR,
            fg=ACCENT_COLOR,
            cursor="hand2"
        )
        link_label.pack(side="left", padx=(0, 0), anchor="w")
        link_label.bind("<Button-1>", lambda e: webbrowser.open("https://byron.wang"))

    def toggle_time_input(self):
        if self.mode.get() == "manual":
            self.time_frame.pack(pady=8)
        else:
            self.time_frame.pack_forget()

    def generate_qr(self):
        url = self.url_entry.get().strip()
        if not url:
            messagebox.showwarning("输入为空", "请先粘贴课程链接！")
            self.url_entry.focus_set()
            return

        if "ccc.nottingham.edu.cn/study/home/details" not in url:
            messagebox.showerror("链接错误", "链接必须来自 UNNC 中国文化课详情页！")
            return

        try:
            schedule_id = None
            if "id=" in url:
                schedule_id = url.split("id=")[1].split("&")[0].split("#")[0]
            elif "scheduleId=" in url:
                schedule_id = url.split("scheduleId=")[1].split("&")[0].split("#")[0]

            if not schedule_id:
                raise ValueError("无法从链接中提取到有效的 id 或 scheduleId")

            if self.mode.get() == "manual":
                try:
                    manual_time = tuple(int(entry.get()) for entry in self.entries)
                    datetime.datetime(*manual_time) # Validate time
                except (ValueError, TypeError, OverflowError):
                    messagebox.showerror(
                        "时间格式错误",
                        "请检查年月日时分是否填写正确（如：月≤12，日≤31，时<24）",
                    )
                    return
                attendance_url = generate_attendance_url(
                    schedule_id, mode="manual", manual_time=manual_time
                )
            else:
                attendance_url = generate_attendance_url(schedule_id)

            img = make_qr_image(attendance_url)
            self.qr_photo = ImageTk.PhotoImage(img)
            self.qr_label.configure(image=self.qr_photo)
            img.save("qrcode.png")
            messagebox.showinfo(
                "成功！",
                f"二维码已保存为当前目录下的 qrcode.png\n\n签到链接：\n{attendance_url}",
            )

        except Exception as e:
            messagebox.showerror("错误", f"生成失败：{str(e)}")

if __name__ == "__main__":
    root = tk.Tk()
    app = QRGeneratorApp(root)
    root.mainloop()
