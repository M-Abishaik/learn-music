from math import ceil
def Construct_svaras(raga_no):
	#Input:  raga_no is Raga Number that corresponds to Melakarta Ragas names.
	#Output: outputs the basic svaras in Carnatic,western notation for a given raga
	
	Western_svaras=dict()
	Carnatic_svaras=dict()

	#define Ṣhaḍja from Melakarta Rule-1 
	Western_svaras['s']='C'
	Carnatic_svaras['s']='S'

	#define Ṣhaḍja from Melakarta Rule-1
	Western_svaras['p']='G' 
	Carnatic_svaras['p']='P'

	#define Madhyama from Melakarta Rule-2 
	if(raga_no<=36):
		Western_svaras['m']='F'
		Carnatic_svaras['m']='M1'
	else:
		Western_svaras['m']='F#'
		Carnatic_svaras['m']='M2'

	#define group  number from the raga number,swara no in the group
	group_no=ceil(raga_no/6)
	swara_no=raga_no%6

	#define code for each group and for each swara in a group
	code=[[3,3],[1,1],[1,2],[1,3],[2,2],[2,3]]
	
	#define Rishabha one indexed R1,R2,R3
	R=[None,'C#','D','D#']

	#define Gandhara one indexed G1,G2,G3
	G=[None,'D','D#','E']

	#define Dhaivata one indexed D1,D2,D3
	D=[None,'G#','A','A#']

	#define Nishada one indexed N1,N2,N3
	N=[None,'A','A#','B']

	#define Rishabha,Gandhara swara for the given raga from group number
	Western_svaras['r']=R[code[group_no%6][0]]
	Western_svaras['g']=G[code[group_no%6][1]]

	#define Dhaivata,Nishada swara for the given raga from swara number
	Western_svaras['d']=D[code[swara_no%6][0]]
	Western_svaras['n']=N[code[swara_no%6][1]]

	Carnatic_svaras['r']='R'+str(code[group_no%6][0])
	Carnatic_svaras['g']='G'+str(code[group_no%6][1])
	Carnatic_svaras['d']='D'+str(code[swara_no%6][0])
	Carnatic_svaras['n']='N'+str(code[swara_no%6][1])
	return Carnatic_svaras,Western_svaras

class Build_Notes():
	def __init__(self,notes):
		self._post=[]
		self.build_lesson(notes)
	def getNotes(self):
		return self._post	
	def build_lesson(self,notes):
		N=len(notes)
		L=2*N
		self.input_notes=notes
		self.lesson_notes=[None]*L
		self.build_tree(1,0,N-1)
		#print(self.lesson_notes)
		self._post=[]
		self.pre_to_post(self.lesson_notes,1,L)
		self._post.reverse()
		return self._post
	def build_tree(self,index,a,b):
		if a>b: #out of index
			return 
		if a==b:
			#print(index,len(self.lesson_notes))
			self.lesson_notes[index]=self.input_notes[a]
			return
		self.build_tree(2*index,a,(a+b)//2)
		self.build_tree(2*index+1,(a+b)//2+1,b)
		self.lesson_notes[index]=self.lesson_notes[2*index]+' '+self.lesson_notes[2*index+1]

	def pre_to_post(self,nodes,index,L):
		if(index>=L):
			 return
		self._post.append(nodes[index])
		#print(nodes[index],end=' ')
		self.pre_to_post(nodes,2*index+1,L)
		self.pre_to_post(nodes,2*index,L)