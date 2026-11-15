"""Small lexical splitter for preserving SQL bodies while removing outer transactions."""
import re
def statements(source):
    start=0;i=0;n=len(source)
    while i<n:
        if source.startswith('--',i):
            j=source.find('\n',i);i=n if j<0 else j+1;continue
        if source.startswith('/*',i):
            depth=1;i+=2
            while depth and i<n:
                if source.startswith('/*',i):depth+=1;i+=2
                elif source.startswith('*/',i):depth-=1;i+=2
                else:i+=1
            if depth:raise ValueError('unterminated SQL comment')
            continue
        if source[i] in "'\"":
            quote=source[i];escape=quote=="'" and i>0 and source[i-1] in 'Ee' and (i<2 or not(source[i-2].isalnum()or source[i-2]=='_'));i+=1
            while i<n:
                if escape and source[i]=='\\':i+=2
                elif source[i]==quote:
                    if i+1<n and source[i+1]==quote:i+=2
                    else:i+=1;break
                else:i+=1
            else:raise ValueError('unterminated SQL quote')
            continue
        if source[i]=='$':
            tag=re.match(r'\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$',source[i:])
            if tag:
                end=source.find(tag[0],i+len(tag[0]))
                if end<0:raise ValueError('unterminated SQL dollar body')
                i=end+len(tag[0]);continue
        if source[i]==';':yield source[start:i+1];start=i+1
        i+=1
    if start<n:yield source[start:]

def code(part):
    s=part.lstrip()
    while s.startswith(('--','/*')):
        if s.startswith('--'):
            end=s.find('\n');s='' if end<0 else s[end+1:].lstrip()
        else:
            depth=1;i=2
            while depth and i<len(s):
                if s.startswith('/*',i):depth+=1;i+=2
                elif s.startswith('*/',i):depth-=1;i+=2
                else:i+=1
            if depth:raise ValueError('unterminated leading comment')
            s=s[i:].lstrip()
    return s.strip()

def without_transactions(source):
    parts=list(statements(source));assert ''.join(parts)==source
    kept=[];begins=commits=0
    for p in parts:
        c=code(p).lower()
        if c=='begin;':begins+=1
        elif c=='commit;':commits+=1
        else:
            if c.startswith(('rollback','start transaction','commit ','begin transaction')):raise ValueError('unexpected transaction command')
            kept.append(p)
    if not begins or begins!=commits:raise ValueError('unbalanced source transactions')
    return ''.join(kept),{'beginsRemoved':begins,'commitsRemoved':commits}
